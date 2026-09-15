# 26. Inventory Transaction Catalogue

This document defines the mathematical and logical rules for all permitted transaction types inside Laya's Cakes & Candles `inventory_transaction` ledger.

---

## Transaction Rules Directory

| Transaction Type | Source Location | Destination Location | Quantity Sign | Approval Required | Affects Available Stock? | Description |
| --- | --- | --- | :---: | --- | :---: | --- |
| **`PURCHASE_RECEIPT`** | External Supplier | Factory / Branch | `+` (Credit) | Factory Manager | Yes | Logs stock received from supplier PO matching. |
| **`PRODUCTION_CONSUMPTION`** | Factory Inventory | Intermediate Mixer | `-` (Debit) | Chef | Yes | Deducts raw materials used in recipe runs. |
| **`PRODUCTION_OUTPUT`** | Intermediate Mixer | Factory Inventory | `+` (Credit) | Factory Manager | Yes | Yields finished goods to factory stock. |
| **`TRANSFER_OUT`** | Dispatching Branch | Transit Location | `-` (Debit) | Branch Manager | Yes (Deducts available) | Logs stock dispatched for branch transfers. |
| **`TRANSFER_IN`** | Transit Location | Receiving Branch | `+` (Credit) | Branch Manager | Yes | Acknowledges received transfer items at branch. |
| **`SALE`** | Branch Inventory | Counter Customer | `-` (Debit) | Cashier | Yes | POS retail invoice checkout. |
| **`SALE_RETURN`** | Counter Customer | Branch Inventory | `+` (Credit) | Owner / Sudha | Yes | Re-enters items back to stock. |
| **`WASTE_PENDING`** | Branch Inventory | Quarantine Zone | `-` (Debit) | Manager | Yes (Deducts available) | Quarantines damaged items awaiting write-off. |
| **`WASTE_APPROVED`** | Quarantine Zone | Destructive Write-off| `-` (Debit) | Owner / Sudha | Yes (Permanent deduct) | Owner signs off and writes off quarantined waste. |
| **`ADJUSTMENT_POSITIVE`**| Discrepancy Error | Location Inventory | `+` (Credit) | Owner / Sudha | Yes | Corrects stock upward during physical audit. |
| **`ADJUSTMENT_NEGATIVE`**| Location Inventory | Discrepancy Error | `-` (Debit) | Owner / Sudha | Yes | Corrects stock downward during physical audit. |
| **`CONVERSION_OUT`** | Location (Whole cake) | Conversion Mixer | `-` (Debit) | Branch Manager | Yes | Deducts whole cake to convert to slices. |
| **`CONVERSION_IN`** | Conversion Mixer | Location (Slices) | `+` (Credit) | Branch Manager | Yes | Yields converted slices back to available stock. |
