const { describe } = require('tape-plus')
const tmpDir = require('tmp').dirSync

const KappaBlsSign = require('../')


describe('basic', (context) => {
  context('key generation and signing', (assert, next) => {
    const member = KappaBlsSign(3, 5, { storage: tmpDir().name })
    member.ready(() => {
      member.publishId('George', (err) => {
        assert.error(err, 'No error')
        member.buildIndexes(() => {
          member.queryIds(() => {
            console.log(member.member.members) 
            next()
          })
        })
      })
    })
  })
})
