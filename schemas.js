const validator = require('is-my-json-valid')
const VERSION = '1.0.0'

const version = { required: true, type: 'string', pattern: VERSION }
const timestamp = { required: true, type: 'number' } // TODO: realistic range
const type = (messageType) => { return { required: true, type: 'string', pattern: `^${messageType}$` } }
const recipients = {
  type: 'array',
  maxItems: 7,
  minItems: 1,
  items: {
    type: 'string'
    // TODO: regex
  }
}

const isId = validator({
  $schema: 'http://json-schema.org/schema#',
  type: 'object',
  properties: {
    type: type('id'),
    version,
    timestamp,
    id: {
      required: true,
      type: 'string'
      // TODO regex
    }
    // TODO allow also a name property?
  }
})

function createIsVvec(threshold) {
  return validator({
    $schema: 'http://json-schema.org/schema#',
    type: 'object',
    properties: {
      type: type('vvec'),
      version,
      timestamp,
      vvec: {
        type: 'array',
        required: true,
        minItems: threshold,
        maxItems: threshold,
        items: {
          type: 'string'
          // TODO: regex for hex encoded bls public key
        }
      }
    }
  })
}

const isShareContribution = validator({
  $schema: 'http://json-schema.org/schema#',
  type: 'object',
  properties: {
    type: type('share-contribution'),
    version,
    timestamp,
    shareContribution: {
      required: true,
      type: 'string'
      // TODO regex for hex encoded bls private key
    },
    recipients
  }
})

const isRequestToSign = validator({
  $schema: 'http://json-schema.org/schema#',
  type: 'object',
  properties: {
    type: type('requestToSign'),
    version,
    timestamp,
    message: {
      required: true,
      type: 'string'
      // TODO: allow binary message
      // TODO: minimum / maximum length
    },
    recipients
  }
})

const isSignature = validator({
  $schema: 'http://json-schema.org/schema#',
  type: 'object',
  properties: {
    type: type('signature'),
    version,
    timestamp,
    hashOfMessage: {
      required: true,
      type: 'string'
      // TODO: regex for hex encoded sha256 (32 bytes)
    },
    signature: {
      required: true,
      type: 'string'
      // TODO: regex for hex encoded bls signature
    },
    recipients
  }
})
// TODO: type: renewshares
module.exports = { isId, createIsVvec, isShareContribution, isRequestToSign, isSignature }
