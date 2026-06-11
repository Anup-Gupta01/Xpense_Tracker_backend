const { validationResult, body, param } = require('express-validator');

/**
 * Runs validationResult and returns 422 if there are errors.
 * Must be used AFTER the validation chain middleware.
 */
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array().map((e) => ({ field: e.path, message: e.msg })),
    });
  }
  next();
};

// ── Auth validators ────────────────────────────────────────────────────────────
const registerRules = [
  body('name').trim().notEmpty().withMessage('Name is required').isLength({ max: 100 }),
  body('email').trim().isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
];

const loginRules = [
  body('email').trim().isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('password').notEmpty().withMessage('Password is required'),
];

// ── Expense validators ────────────────────────────────────────────────────────
const expenseRules = [
  body('description').trim().notEmpty().withMessage('Description is required'),
  body('amount').isFloat({ min: 0.01 }).withMessage('Amount must be a positive number'),
  body('date').isISO8601().withMessage('Valid date is required').toDate(),
  body('category').optional().isString(),
  body('paymentMethod').optional().isString(),
  body('status').optional().isIn(['completed', 'pending', 'failed']),
];

// ── Budget validators ─────────────────────────────────────────────────────────
const budgetRules = [
  body('category').notEmpty().withMessage('Category is required'),
  body('limitAmount').isFloat({ min: 1 }).withMessage('Limit must be at least 1'),
  body('period').optional().isString(),
];

// ── ID param validator ────────────────────────────────────────────────────────
const idRule = [
  param('id').isMongoId().withMessage('Invalid ID format'),
];

module.exports = { validate, registerRules, loginRules, expenseRules, budgetRules, idRule };
