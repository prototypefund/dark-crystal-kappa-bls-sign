const { describe } = require('tape-plus')
const tmpDir = require('tmp').dirSync
const schemas = require('../schemas')
const async = require('async')

const KappaBlsSign = require('../')

describe('basic', (context) => {
  context('key generation', (assert, next) => {
    const signers = []
    const signerNames = ['Hedwig', 'George', 'Awet', 'Gertrude', 'Berni']
    async.each(signerNames, (name, cb) => {
      const signer = KappaBlsSign(3, 5, { storage: tmpDir().name })
      signer.ready(() => {
        signer.publishId(name, (err) => {
          assert.error(err, 'No error')
          signers.push(signer)
          cb()
        })
      })
    }, (err) => {
      assert.error(err, 'No error')
      async.each(signers, (signer, cb) => {
        signer.buildIndexes(() => {
          signer.queryIds(() => {
            signer.publishContribution((err) => {
              assert.error(err, 'No error on publishing contribution')
              cb()
            })
          })
        })
      })
    }, (err) => {
      assert.error(err, 'No error')
      next()
    })
  })
})
