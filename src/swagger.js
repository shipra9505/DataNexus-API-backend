module.exports = {
  openapi: '3.0.1',
  info: {
    title: 'Bluestock Village API',
    version: '1.0.0',
    description: 'B2B API for village lookup, API keys, and usage analytics',
  },
  servers: [
    {
      url: 'http://localhost:3000/api/v1',
      description: 'Local development server'
    }
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT'
      },
      apiKeyAuth: {
        type: 'apiKey',
        in: 'header',
        name: 'X-API-Key'
      }
    },
    schemas: {
      User: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          businessName: { type: 'string' },
          email: { type: 'string', format: 'email' },
          phone: { type: 'string' },
          gst: { type: 'string' },
          role: { type: 'string' },
          plan: { type: 'string' },
          status: { type: 'string' },
          dailyLimit: { type: 'integer' },
          emailVerified: { type: 'boolean' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' }
        }
      },
      ApiKey: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          status: { type: 'string' },
          createdAt: { type: 'string', format: 'date-time' }
        }
      }
    }
  },
  paths: {
    '/auth/register': {
      post: {
        summary: 'Register a new B2B customer',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['businessName', 'email', 'password'],
                properties: {
                  businessName: { type: 'string' },
                  email: { type: 'string', format: 'email' },
                  phone: { type: 'string' },
                  gst: { type: 'string' },
                  password: { type: 'string', minLength: 8 }
                }
              }
            }
          }
        },
        responses: {
          '201': { description: 'Registration accepted' },
          '400': { description: 'Validation error' }
        }
      }
    },
    '/auth/login': {
      post: {
        summary: 'Login and receive a JWT token',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string', format: 'email' },
                  password: { type: 'string' }
                }
              }
            }
          }
        },
        responses: {
          '200': { description: 'Login successful' },
          '401': { description: 'Unauthorized' }
        }
      }
    },
    '/auth/me': {
      get: {
        summary: 'Return current authenticated user',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': { description: 'Current user returned' }
        }
      }
    },
    '/auth/apikeys': {
      get: {
        summary: 'List active API keys for current user',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'API keys returned' } }
      },
      post: {
        summary: 'Create a new API key for current user',
        security: [{ bearerAuth: [] }],
        responses: { '201': { description: 'API key created' } }
      }
    },
    '/auth/apikeys/{id}/revoke': {
      patch: {
        summary: 'Revoke an API key',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { '200': { description: 'API key revoked' } }
      }
    },
    '/auth/apikeys/{id}/rotate': {
      patch: {
        summary: 'Rotate an existing API key',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { '200': { description: 'API key rotated' } }
      }
    },
    '/auth/verify-email': {
      post: {
        summary: 'Verify user email address',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['token'],
                properties: {
                  token: { type: 'string' }
                }
              }
            }
          }
        },
        responses: {
          '200': { description: 'Email verified' },
          '400': { description: 'Invalid or expired token' }
        }
      }
    },
    '/usage/dashboard': {
      get: {
        summary: 'Get usage dashboard for authenticated user',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': {
            description: 'Usage dashboard returned',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: {
                      type: 'object',
                      properties: {
                        dailyLimit: { type: 'integer' },
                        todayRequests: { type: 'integer' },
                        totalRequests: { type: 'integer' },
                        remainingToday: { type: 'integer' },
                        last7Days: {
                          type: 'array',
                          items: {
                            type: 'object',
                            properties: {
                              day: { type: 'string' },
                              requests: { type: 'integer' }
                            }
                          }
                        },
                        successRate: { type: 'integer' },
                        averageResponse: { type: 'integer' },
                        topEndpoints: {
                          type: 'array',
                          items: {
                            type: 'object',
                            properties: {
                              endpoint: { type: 'string' },
                              count: { type: 'integer' }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/usage/recent': {
      get: {
        summary: 'Get recent usage logs for authenticated user',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': {
            description: 'Recent usage logs returned',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          id: { type: 'integer' },
                          endpoint: { type: 'string' },
                          method: { type: 'string' },
                          statusCode: { type: 'integer' },
                          responseTime: { type: 'integer' },
                          date: { type: 'string', format: 'date-time' }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/states': {
      get: {
        summary: 'Get all states',
        responses: {
          '200': {
            description: 'States returned',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    count: { type: 'integer' },
                    data: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          id: { type: 'integer' },
                          name: { type: 'string' },
                          code: { type: 'string' },
                          _count: {
                            type: 'object',
                            properties: {
                              districts: { type: 'integer' }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/states/{id}': {
      get: {
        summary: 'Get a specific state by ID',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'integer' },
            description: 'State ID'
          }
        ],
        responses: {
          '200': {
            description: 'State returned',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: {
                      type: 'object',
                      properties: {
                        id: { type: 'integer' },
                        name: { type: 'string' },
                        code: { type: 'string' },
                        _count: {
                          type: 'object',
                          properties: {
                            districts: { type: 'integer' }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          },
          '404': { description: 'State not found' }
        }
      }
    },
    '/districts': {
      get: {
        summary: 'Get districts, optionally filtered by state',
        parameters: [
          {
            name: 'stateId',
            in: 'query',
            schema: { type: 'integer' },
            description: 'Filter by state ID'
          }
        ],
        responses: {
          '200': {
            description: 'Districts returned',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    count: { type: 'integer' },
                    data: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          id: { type: 'integer' },
                          name: { type: 'string' },
                          state: {
                            type: 'object',
                            properties: {
                              id: { type: 'integer' },
                              name: { type: 'string' },
                              code: { type: 'string' }
                            }
                          },
                          _count: {
                            type: 'object',
                            properties: {
                              subDistricts: { type: 'integer' }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/districts/{id}': {
      get: {
        summary: 'Get a specific district by ID',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'integer' },
            description: 'District ID'
          }
        ],
        responses: {
          '200': {
            description: 'District returned',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: {
                      type: 'object',
                      properties: {
                        id: { type: 'integer' },
                        name: { type: 'string' },
                        state: {
                          type: 'object',
                          properties: {
                            id: { type: 'integer' },
                            name: { type: 'string' },
                            code: { type: 'string' }
                          }
                        },
                        _count: {
                          type: 'object',
                          properties: {
                            subDistricts: { type: 'integer' }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          },
          '404': { description: 'District not found' }
        }
      }
    },
    '/subdistricts': {
      get: {
        summary: 'Get subdistricts, optionally filtered by district',
        parameters: [
          {
            name: 'districtId',
            in: 'query',
            schema: { type: 'integer' },
            description: 'Filter by district ID'
          }
        ],
        responses: {
          '200': {
            description: 'Subdistricts returned',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    count: { type: 'integer' },
                    data: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          id: { type: 'integer' },
                          name: { type: 'string' },
                          district: {
                            type: 'object',
                            properties: {
                              id: { type: 'integer' },
                              name: { type: 'string' },
                              state: {
                                type: 'object',
                                properties: {
                                  id: { type: 'integer' },
                                  name: { type: 'string' },
                                  code: { type: 'string' }
                                }
                              }
                            }
                          },
                          _count: {
                            type: 'object',
                            properties: {
                              villages: { type: 'integer' }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/subdistricts/{id}': {
      get: {
        summary: 'Get a specific subdistrict by ID',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'integer' },
            description: 'Subdistrict ID'
          }
        ],
        responses: {
          '200': {
            description: 'Subdistrict returned',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: {
                      type: 'object',
                      properties: {
                        id: { type: 'integer' },
                        name: { type: 'string' },
                        district: {
                          type: 'object',
                          properties: {
                            id: { type: 'integer' },
                            name: { type: 'string' },
                            state: {
                              type: 'object',
                              properties: {
                                id: { type: 'integer' },
                                name: { type: 'string' },
                                code: { type: 'string' }
                              }
                            }
                          }
                        },
                        _count: {
                          type: 'object',
                          properties: {
                            villages: { type: 'integer' }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          },
          '404': { description: 'Subdistrict not found' }
        }
      }
    },
    '/villages': {
      get: {
        summary: 'Get villages, optionally filtered by subdistrict',
        parameters: [
          {
            name: 'subDistrictId',
            in: 'query',
            schema: { type: 'integer' },
            description: 'Filter by subdistrict ID'
          }
        ],
        responses: {
          '200': {
            description: 'Villages returned',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    count: { type: 'integer' },
                    data: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          id: { type: 'integer' },
                          name: { type: 'string' },
                          code: { type: 'string' },
                          subDistrict: {
                            type: 'object',
                            properties: {
                              id: { type: 'integer' },
                              name: { type: 'string' },
                              district: {
                                type: 'object',
                                properties: {
                                  id: { type: 'integer' },
                                  name: { type: 'string' },
                                  state: {
                                    type: 'object',
                                    properties: {
                                      id: { type: 'integer' },
                                      name: { type: 'string' },
                                      code: { type: 'string' }
                                    }
                                  }
                                }
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/villages/{id}': {
      get: {
        summary: 'Get a specific village by ID',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'integer' },
            description: 'Village ID'
          }
        ],
        responses: {
          '200': {
            description: 'Village returned',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: {
                      type: 'object',
                      properties: {
                        id: { type: 'integer' },
                        name: { type: 'string' },
                        code: { type: 'string' },
                        subDistrict: {
                          type: 'object',
                          properties: {
                            id: { type: 'integer' },
                            name: { type: 'string' },
                            district: {
                              type: 'object',
                              properties: {
                                id: { type: 'integer' },
                                name: { type: 'string' },
                                state: {
                                  type: 'object',
                                  properties: {
                                    id: { type: 'integer' },
                                    name: { type: 'string' },
                                    code: { type: 'string' }
                                  }
                                }
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          },
          '404': { description: 'Village not found' }
        }
      }
    },
    '/search': {
      get: {
        summary: 'Search villages by name',
        parameters: [
          {
            name: 'q',
            in: 'query',
            required: true,
            schema: { type: 'string', minLength: 2 },
            description: 'Search query (minimum 2 characters)'
          },
          {
            name: 'stateId',
            in: 'query',
            schema: { type: 'integer' },
            description: 'Filter by state ID'
          },
          {
            name: 'districtId',
            in: 'query',
            schema: { type: 'integer' },
            description: 'Filter by district ID'
          },
          {
            name: 'limit',
            in: 'query',
            schema: { type: 'integer', minimum: 1, maximum: 50, default: 10 },
            description: 'Maximum number of results (default: 10, max: 50)'
          }
        ],
        responses: {
          '200': {
            description: 'Search results returned',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    count: { type: 'integer' },
                    data: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          value: { type: 'integer' },
                          label: { type: 'string' },
                          code: { type: 'string' },
                          fullAddress: { type: 'string' },
                          hierarchy: {
                            type: 'object',
                            properties: {
                              village: { type: 'string' },
                              subDistrict: { type: 'string' },
                              district: { type: 'string' },
                              state: { type: 'string' }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          },
          '400': { description: 'Invalid query parameters' }
        }
      }
    },
    '/search/autocomplete': {
      get: {
        summary: 'Autocomplete village names',
        parameters: [
          {
            name: 'q',
            in: 'query',
            required: true,
            schema: { type: 'string', minLength: 2 },
            description: 'Autocomplete query (minimum 2 characters)'
          }
        ],
        responses: {
          '200': {
            description: 'Autocomplete suggestions returned',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    count: { type: 'integer' },
                    data: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          value: { type: 'integer' },
                          label: { type: 'string' },
                          code: { type: 'string' },
                          address: { type: 'string' }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
}
