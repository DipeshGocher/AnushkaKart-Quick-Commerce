import React from 'react';
import { useRoutes } from 'react-router-dom';
import ProtectedRoute from '../../guards/ProtectedRoute';
import RoleGuard from '../../guards/RoleGuard';
import { UserRole } from '../../constants/roles';
import SellerRoutes, { sellerRoutes } from '../../../modules/seller/routes/index';

/**
 * The whole seller panel. AppRouter loads this file only when someone opens a /seller page,
 * so customers never download the seller code. It is mounted on /seller/* and the paths below
 * are relative to that.
 */
const SellerPanel = () =>
  useRoutes([
    {
      path: '/',
      element: (
        <ProtectedRoute>
          <RoleGuard allowedRoles={[UserRole.SELLER]}>
            <SellerRoutes />
          </RoleGuard>
        </ProtectedRoute>
      ),
      children: sellerRoutes,
    },
  ]);

export default SellerPanel;
