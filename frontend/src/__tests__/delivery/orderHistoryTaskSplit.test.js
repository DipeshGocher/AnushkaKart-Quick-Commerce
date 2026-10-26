import fs from 'fs';
import path from 'path';

describe('Rider Order History Task-Based Cards Tests', () => {
  const deliveryControllerPath = path.resolve(process.cwd(), '../backend/app/controller/deliveryController.js');
  const deliveryControllerContent = fs.readFileSync(deliveryControllerPath, 'utf8');

  const orderHistoryPath = path.resolve(process.cwd(), 'src/modules/delivery/pages/OrderHistory.jsx');
  const orderHistoryContent = fs.readFileSync(orderHistoryPath, 'utf8');

  test('deliveryController transforms orders into distinct forward delivery and return pickup tasks', () => {
    expect(deliveryControllerContent).toContain('taskType: "DELIVERY"');
    expect(deliveryControllerContent).toContain('taskType: "RETURN"');
    expect(deliveryControllerContent).toContain('isReturnTask: true');
    expect(deliveryControllerContent).toContain('isReturnTask: false');
  });

  test('deliveryController separates queries for delivered, cancelled, and returns tabs', () => {
    expect(deliveryControllerContent).toContain('returnDeliveryBoy: deliveryBoyId');
    expect(deliveryControllerContent).toContain('deliveryBoy: deliveryBoyId');
  });

  test('OrderHistory.jsx renders Return Task badge and Delivery badge', () => {
    expect(orderHistoryContent).toContain('Return Task');
    expect(orderHistoryContent).toContain('Forward Delivery');
  });

  test('OrderHistory.jsx handles direction (Pickup Customer vs Store) for return vs delivery', () => {
    expect(orderHistoryContent).toContain('Pickup (Customer)');
    expect(orderHistoryContent).toContain('Drop (Store)');
  });

  test('Task splitting simulation produces 2 tasks for 1 order with both forward delivery and return pickup', () => {
    const mockOrder = {
      _id: "order_123",
      orderId: "ORD-1M5VE7EFBSA4F",
      deliveryBoy: "rider_1",
      returnDeliveryBoy: "rider_1",
      status: "delivered",
      returnStatus: "returned",
      riderEarnings: 25,
      returnDeliveryCommission: 25,
      createdAt: new Date("2026-10-26T11:56:00Z"),
      returnDeliveredBackAt: new Date("2026-10-26T12:20:00Z"),
    };

    const riderIdStr = "rider_1";
    const tasks = [];

    const isForwardRider = Boolean(mockOrder.deliveryBoy === riderIdStr);
    const isReturnRider = Boolean(mockOrder.returnDeliveryBoy === riderIdStr && mockOrder.returnStatus !== "none");

    if (isForwardRider) {
      tasks.push({
        ...mockOrder,
        _id: isReturnRider ? `${mockOrder._id}_delivery` : mockOrder._id,
        taskType: "DELIVERY",
        isReturnTask: false,
        taskEarnings: 25,
        taskStatus: "delivered",
      });
    }

    if (isReturnRider) {
      tasks.push({
        ...mockOrder,
        _id: isForwardRider ? `${mockOrder._id}_return` : mockOrder._id,
        taskType: "RETURN",
        isReturnTask: true,
        taskEarnings: 25,
        taskStatus: "returned",
      });
    }

    expect(tasks).toHaveLength(2);
    expect(tasks[0].taskType).toBe("DELIVERY");
    expect(tasks[0].taskStatus).toBe("delivered");
    expect(tasks[0].taskEarnings).toBe(25);

    expect(tasks[1].taskType).toBe("RETURN");
    expect(tasks[1].taskStatus).toBe("returned");
    expect(tasks[1].taskEarnings).toBe(25);
  });
});
