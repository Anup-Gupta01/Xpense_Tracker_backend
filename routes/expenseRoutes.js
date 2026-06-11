const express = require('express');
const router  = express.Router();

const { getExpenses, createExpense, updateExpense, deleteExpense } = require('../controllers/expenseController');
const { protect }                           = require('../middleware/auth');
const { validate, expenseRules, idRule }    = require('../middleware/validate');

router.get   ('/',    protect, getExpenses);
router.post  ('/',    protect, expenseRules, validate, createExpense);
router.put   ('/:id', protect, idRule, expenseRules, validate, updateExpense);
router.delete('/:id', protect, idRule, validate, deleteExpense);

module.exports = router;
