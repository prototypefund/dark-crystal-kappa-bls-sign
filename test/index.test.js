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
  const feedsDone = []
  // async.eachOf(feeds, (feed, i1, cb1) => {
  //   if (i1 === 0) return cb1()
  //   replicate(feeds[0], feed, cb1)
  // }, (err) => {
  //   console.log('therekjh', err)
  //   callback(err)
  // })
  async.eachOf(feeds, (feed1, i1, cb1) => {
    feedsDone.push(i1)
    async.eachOf(feeds, (feed2, i2, cb2) => {
      if (i1 === i2) return cb2()
      if (feedsDone.indexOf(i2) > -1) return cb2()
      console.log(i1, i2)
      replicate(feed1, feed2, (err) => {
        if (err) return cb2(err)
        console.log('callback reached', i1, i2)
        return cb2()
      })
    }, (err) => {
      if (err) return cb1(err)
      cb1()
    })
  }, (err) => {
    console.log('therekjh', err)
    callback(err)
  })
}

function replicate (feed1, feed2, cb) {
  var s = feed1.replicate({ live: false })
  var d = feed2.replicate({ live: false })

  s.pipe(d).pipe(s)
  s.on('error', (err) => {
    console.log('rrr',err)
    cb(err)
  })
  s.on('end', () => {
    console.log('here end')
    return cb()
  })
}
