const { query, param } = require('express-validator')

const villageListValidation = [
  query('subDistrictId')
    .exists().withMessage('subDistrictId is required')
    .isInt({ min: 1 }).withMessage('subDistrictId must be a positive integer'),
  query('page')
    .optional()
    .isInt({ min: 1 }).withMessage('page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 }).withMessage('limit must be between 1 and 100')
]

const villageByIdValidation = [
  param('id')
    .isInt({ min: 1 }).withMessage('id must be a positive integer')
]

module.exports = { villageListValidation, villageByIdValidation }
