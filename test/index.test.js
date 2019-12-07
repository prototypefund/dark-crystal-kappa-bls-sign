const { describe } = require('tape-plus')
const tmpDir = require('tmp').dirSync
const async = require('async')
const pull = require('pull-stream')

const KappaBlsSign = require('../')

describe('basic', (context) => {
  context('key generation', (assert, next) => {
    const signers = []
    const signerNames = ['Hedwig', 'George', 'Awet', 'Gertrude', 'Berni']
    async.each(signerNames, (name, cb) => {
      const signer = KappaBlsSign(3, 5, { storage: tmpDir().name })
      signer.ready(() => {
        assert.true(Buffer.isBuffer(signer.member.id), 'signer id is a buffer')
        assert.equal(signer.member.id.length, 32, 'signer id is 32 bytes')
        assert.equal(signer.member.numMembers, 5, 'numMembers is correct')
        assert.equal(signer.member.threshold, 3, 'treshold is correct')
        assert.equal(signer.blsId, signer.member.skHex, 'bls id correct')
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
        }, (err) => {
          assert.error(err, 'No error')
          replicateArray(signers, (err) => {
            assert.error(err, 'No error when replicating')
            async.each(signers, (signer, cb) => {
              signer.queryContributions(() => {
                // assert.ok(members[Object.keys(members)[1]].groupSignatures[message], 'Group signature valid')
                cb()
              })
            }, (err) => {
              assert.error(err, 'No error')
              testSigning(next)
            })
          })
        })
      })
    })

    function testSigning (callback) {
      const message = { content: 'dogbowl' }
      async.each(signers.slice(0, 3), (signer, cb) => {
        signer.signMessage(message, cb)
      }, (err) => {
        assert.error(err, 'no error')
        replicateArray(signers, (err) => {
          assert.error(err, 'No error on replicate')
          async.each(signers, (signer, cb) => {
            signer.querySignatures(cb)
          }, callback)
        })
      })
    }
  })
})

function replicateArray (feeds, callback) {
  const combs = []
  for (const i of feeds.keys()) {
    for (const i2 of feeds.keys()) {
      if (i < i2) combs.push([i, i2])
    }
  }

  pull(
    pull.values(combs),
    pull.asyncMap((comb, cb) => {
      replicate(feeds[comb[0]], feeds[comb[1]], cb)
    }),
    pull.collect(callback)
  )
}

function replicate (feed1, feed2, cb) {
  var s = feed1.replicate({ live: false })
  var d = feed2.replicate({ live: false })

  s.pipe(d).pipe(s)
  s.on('error', cb)
  s.on('end', cb)
}
