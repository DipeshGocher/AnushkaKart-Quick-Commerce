import React from 'react';
import { useRoutes } from 'react-router-dom';
import ProtectedRoute from '../../guards/ProtectedRoute';
import RoleGuard from '../../guards/RoleGuard';
import { UserRole } from '../../constants/roles';
import DeliveryRoutes, { deliveryRoutes } from '../../../modules/delivery/routes/index';

/**
 * The whole delivery panel. AppRouter loads this file only when someone opens a /delivery page,
 * so customers never download the delivery code. It is mounted on /delivery/* and the paths below
 * are relative to that.
 */
const DeliveryPanel = () =>
  useRoutes([
    {
      path: '/',
      element: (
        <ProtectedRoute>
          <RoleGuard allowedRoles={[UserRole.DELIVERY]}>
            <DeliveryRoutes />
          </RoleGuard>
        </ProtectedRoute>
      ),
      children: deliveryRoutes,
    },
  ]);

export default DeliveryPanel;
