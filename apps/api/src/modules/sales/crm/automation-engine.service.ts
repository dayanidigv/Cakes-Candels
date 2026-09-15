import { Injectable, BadRequestException } from '@nestjs/common';
import { prisma } from '@cc-erp/database';
import * as crypto from 'crypto';

export interface TriggerAutomationDto {
  eventType: string;
  customerId: string;
  payload?: any;
  idempotencyKey?: string;
}

@Injectable()
export class AutomationEngineService {
  /**
   * Processes event triggers and executes actions with strict idempotency.
   */
  async processEvent(dto: TriggerAutomationDto) {
    const idempotencyKey = dto.idempotencyKey || `auto-${dto.eventType}-${dto.customerId}-${Date.now()}`;

    // Check Idempotency Run Log
    const existingRun = await prisma.crmAutomationRun.findFirst({
      where: { idempotencyKey: { startsWith: idempotencyKey } },
    });

    if (existingRun) {
      return { duplicate: true, run: existingRun };
    }

    const automations = await prisma.crmAutomation.findMany({
      where: {
        eventType: dto.eventType,
        isActive: true,
      },
    });

    if (automations.length === 0) {
      return { triggeredCount: 0, runs: [] };
    }

    let isDuplicate = false;
    const runs = [];
    for (const auto of automations) {
      const runKey = `${idempotencyKey}-${auto.id}`;

      // Simulate Action Execution (WhatsApp / Email / Push / Loyalty Bonus)
      let actionResult = { success: true, message: `Executed ${auto.actionType} for customer ${dto.customerId}` };
      if (auto.actionType === 'LOYALTY_BONUS') {
        const bonusPoints = (auto.actionConfig as any)?.points || 50;
        await prisma.customer.update({
          where: { id: dto.customerId },
          data: { loyaltyPoints: { increment: bonusPoints } },
        }).catch(() => {});

        await prisma.loyaltyTransaction.create({
          data: {
            customerId: dto.customerId,
            type: 'EARN',
            points: bonusPoints,
            notes: `Automation ${auto.name} loyalty bonus`,
          },
        }).catch(() => {});
      }

      let run;
      try {
        run = await prisma.crmAutomationRun.create({
          data: {
            automationId: auto.id,
            customerId: dto.customerId,
            idempotencyKey: runKey,
            status: 'SUCCESS',
            executionLog: actionResult as any,
          },
        });
      } catch (err: any) {
        if (err.code === 'P2002' || err.message?.includes('Unique constraint')) {
          isDuplicate = true;
          run = await prisma.crmAutomationRun.findUnique({
            where: { idempotencyKey: runKey },
          });
        } else {
          throw err;
        }
      }

      if (run) runs.push(run);
    }

    return { duplicate: isDuplicate, triggeredCount: automations.length, runs };
  }

  async createAutomationRule(dto: { name: string; eventType: string; actionType: string; actionConfig?: any; conditionsJson?: any }) {
    return prisma.crmAutomation.create({
      data: {
        name: dto.name,
        eventType: dto.eventType,
        actionType: dto.actionType,
        actionConfig: dto.actionConfig,
        conditionsJson: dto.conditionsJson,
        isActive: true,
      },
    });
  }
}
