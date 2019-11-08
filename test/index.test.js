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
          assert.error(err, 'No error when publishing id')
          signers.push(signer)
          cb()
        })
      })
    }, (err) => {
      assert.error(err, 'No error')
      replicateArray(signers, (err) => {
        assert.error(err, 'No error when replicating')
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
      })
    }, (err) => {
      assert.error(err, 'No error')
      next()
    })
  })
})

function replicateArray (feeds, callback) {
  async.each(feeds, (feed1, cb1) => {
    async.each(feeds, (feed2, cb2) => {
      if (feed1.key.toString('hex') === feed2.key.toString('hex')) return cb2()
      replicate(feed1, feed2, cb2)
    }, cb1)
  }, (err) => {
    console.log('therekjh', err)
    callback(err)
  })
}

function replicate (feed1, feed2, cb) {
  var s = feed1.replicate({ live: false })
  var d = feed2.replicate({ live: false })

  s.pipe(d).pipe(s)
  s.on('error', cb)
  s.on('end', () => {
    console.log('here end')
    cb()
  })
}
