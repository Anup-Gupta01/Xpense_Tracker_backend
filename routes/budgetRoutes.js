const express = require('express');
const router  = express.Router();

const { getBudgets, createBudget, updateBudget, deleteBudget } = require('../controllers/budgetController');
const { protect }                          = require('../middleware/auth');
const { validate, budgetRules, idRule }    = require('../middleware/validate');

router.get   ('/',    protect, getBudgets);
router.post  ('/',    protect, budgetRules, validate, createBudget);
router.put   ('/:id', protect, idRule, validate, updateBudget);
router.delete('/:id', protect, idRule, validate, deleteBudget);

module.exports = router;
