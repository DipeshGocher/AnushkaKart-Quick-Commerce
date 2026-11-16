import React from 'react';
import { useRoutes } from 'react-router-dom';
import ProtectedRoute from '../../guards/ProtectedRoute';
import RoleGuard from '../../guards/RoleGuard';
import { UserRole } from '../../constants/roles';
import AdminRoutes, { adminRoutes } from '../../../modules/admin/routes/index';

/**
 * The whole admin panel. AppRouter loads this file only when someone opens a /admin page,
 * so customers never download the admin code. It is mounted on /admin/* and the paths below
 * are relative to that.
 */
const AdminPanel = () =>
  useRoutes([
    {
      path: '/',
      element: (
        <ProtectedRoute>
          <RoleGuard allowedRoles={[UserRole.ADMIN]}>
            <AdminRoutes />
          </RoleGuard>
        </ProtectedRoute>
      ),
      children: adminRoutes,
    },
  ]);

export default AdminPanel;
