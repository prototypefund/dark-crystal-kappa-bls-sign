const { describe } = require('tape-plus')
const tmpDir = require('tmp').dirSync
const schemas = require('../schemas')

const KappaBlsSign = require('../')


describe('basic', (context) => {
  context('key generation and signing', (assert, next) => {
    const signer = KappaBlsSign(3, 5, { storage: tmpDir().name })
    signer.ready(() => {
      signer.publishId('George', (err) => {
        assert.error(err, 'No error')
        signer.buildIndexes(() => {
          signer.queryIds(() => {
            signer.localFeed.get(0, (err, data) => {
              assert.error(err, 'No error when reading from localFeed')
              assert.ok(schemas.isId(data), 'Published message is of correct form')
              assert.same('George', data.name, 'Name successfully published')
              assert.same(Object.keys(signer.member.members)[0], data.id, 'Published Id successfully stored')
              signer.publishContribution((err) => {
                assert.ok(err, 'publishContribution returns an error when called without enough member Ids')
                next()
              })
            })
          })
        })
      })
    })
  })
})

                // signer.localFeed.head((err, data) => {
                //   console.log(err, data)
                //   next()
                // })
                // const messages = signer.localFeed.createReadStream()
                // messages.on('data', console.log)
                // messages.on('end', next())
