import express from 'express';
import { getFAQs, createFAQ, updateFAQ, deleteFAQ } from '../controller/faqController.js';
import { verifyToken, allowRoles } from '../middleware/authMiddleware.js';

const router = express.Router();

// Public reads (mounted at both /admin/faqs and /public/faqs)
router.get('/', getFAQs);
router.get('/:id', getFAQs);

// Writes are admin-only on either mount point
router.post('/', verifyToken, allowRoles('admin'), createFAQ);
router.put('/:id', verifyToken, allowRoles('admin'), updateFAQ);
router.delete('/:id', verifyToken, allowRoles('admin'), deleteFAQ);

export default router;
