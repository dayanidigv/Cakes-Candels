import { Injectable } from '@nestjs/common';
import { prisma } from '@cc-erp/database';

@Injectable()
export class DashboardService {

  async getOverview() {
    const [
      totalRecipes,
      totalSuppliers,
      activeVehicles,
      totalAttributes,
      totalWorkflows,
      totalNumberSeries
    ] = await Promise.all([
      prisma.recipeMaster.count({ where: { isActive: true } }),
      prisma.supplier.count({ where: { isActive: true } }),
      prisma.vehicle.count({ where: { status: 'ACTIVE' } }),
      prisma.productAttribute.count({ where: { isActive: true } }),
      prisma.approvalWorkflow.count({ where: { isActive: true } }),
      prisma.numberSeries.count({ where: { isActive: true } })
    ]);

    const recentRecipesQuery = await prisma.recipeMaster.findMany({
      where: { isActive: true },
      take: 3,
      orderBy: { createdAt: 'desc' }
    });

    const recentRecipes = recentRecipesQuery.map((r, index) => ({
      name: 'System Admin',
      action: `Edited ${r.name}`,
      img: `https://i.pravatar.cc/150?u=${index + 1}`
    }));

    const topSuppliersQuery = await prisma.supplier.findMany({
      where: { isActive: true },
      take: 4,
      orderBy: { createdAt: 'desc' }
    });

    const topSuppliers = topSuppliersQuery.map(s => ({
      name: s.name,
      count: Math.floor(Math.random() * 20) + 1 // Mocked order count until PO system fully integrated
    }));

    const activeVehiclesQuery = await prisma.vehicle.findMany({
      where: { status: 'ACTIVE' },
      take: 5
    });

    const activeVehiclesList = activeVehiclesQuery.map(v => ({
      loc: v.registrationNumber,
      driver: v.driverName || 'Unassigned'
    }));

    const workflowsQuery = await prisma.approvalWorkflow.findMany({
      where: { isActive: true },
      take: 3
    });

    const workflows = workflowsQuery.map((w, i) => ({
      name: w.moduleName,
      stat: 'In Progress',
      img: `https://i.pravatar.cc/150?u=w${i}`
    }));

    const numberSeriesQuery = await prisma.numberSeries.findMany({
      where: { isActive: true },
      take: 5
    });

    const numberSeriesList = numberSeriesQuery.map(n => ({
      name: n.documentType,
      range: `${n.prefix} - ${n.currentNumber}`,
      stat: 'Active',
      time: 'Today'
    }));

    const activityLogQuery = await prisma.auditLog.findMany({
      take: 4,
      orderBy: { timestamp: 'desc' }
    });

    const activityLog = activityLogQuery.map((log, i) => ({
      user: 'Admin User',
      action: log.action,
      target: log.entity,
      time: log.timestamp.toISOString().split('T')[0],
      img: `https://i.pravatar.cc/150?u=log${i}`
    }));

    // Static Mock Chart Data (Requires complex TSDB aggregation in production)
    const sparklineData = [{v: 10}, {v: 15}, {v: 8}, {v: 25}, {v: 18}, {v: 30}, {v: 28}, {v: 40}, {v: 35}];
    const attributeData = [
      { name: 'Mon', a: 40, b: 24, c: 24 },
      { name: 'Tue', a: 30, b: 13, c: 22 },
      { name: 'Wed', a: 20, b: 48, c: 22 },
      { name: 'Thu', a: 27, b: 39, c: 20 },
      { name: 'Fri', a: 18, b: 48, c: 21 },
      { name: 'Sat', a: 23, b: 38, c: 25 },
      { name: 'Sun', a: 34, b: 43, c: 21 },
    ];
    const pieData = [
      { name: 'Draft', value: 40, color: '#3b82f6' },
      { name: 'In Review', value: 30, color: '#14b8a6' },
      { name: 'Approved', value: 20, color: '#f59e0b' },
      { name: 'Rejected', value: 10, color: '#ef4444' }
    ];

    return {
      metrics: {
        recipes: totalRecipes,
        suppliers: totalSuppliers,
        vehicles: activeVehicles,
        attributes: totalAttributes,
        workflows: totalWorkflows,
        numberSeries: totalNumberSeries
      },
      recentRecipes,
      topSuppliers,
      activeVehicles: activeVehiclesList,
      workflows,
      numberSeries: numberSeriesList,
      activityLog,
      sparklineData,
      attributeData,
      pieData
    };
  }
}
