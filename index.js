const kappa = require('kappa-core')
const kappaPrivate = require('kappa-private')
const level = require('level')
const Query = require('kappa-view-pull-query')
const pull = require('pull-stream')
const ThresholdSig = require('threshold-signatures')
const path = require('path')
const os = require('os')
const queryMfr = require('./query-mfr')
const schemas = require('./schemas')

const LOCAL_FEED = 'local'
const FEEDS = (dir) => path.join(dir, 'feeds')
const VIEWS = (dir) => path.join(dir, 'views')
const STORAGE = '.kappa-bls'
const VERSION = '1.0.0'

module.exports = (threshold, numMembers, opts) => new KappaBls(threshold, numMembers, opts) 

class KappaBls {
  constructor (threshold, numMembers, opts = {}) {
    this.indexesReady = false
    this.asymmetric = new kappaPrivate.Asymmetric()

    this.shares = {}
    this.peerNames = {}
    this.repliedTo = []
    this.recipients = []
    this.threshold = threshold
    this.numMembers = numMembers
    this.storage = opts.storage || path.join(os.homedir(), STORAGE)

    this.core = kappa(
      FEEDS(this.storage),
      { valueEncoding: this.asymmetric.encoder() }
    )
  }

  ready (cb) {
    ThresholdSig.blsInit(() => {
      this.member = ThresholdSig(this.threshold, this.numMembers)
      this.core.writer(LOCAL_FEED, (err, feed) => {
        if (err) return cb(err)
        feed.ready(() => {
          this.localFeed = feed
          this.key = feed.key
          kappaPrivate.getSecretKey(FEEDS(this.storage), this.key, (err, secretKey) => {
            if (err) return cb(err)
            this.asymmetric.secretKey = secretKey

            this.blsId = this.member.initId(this.key) // TODO: what encoding can this be
            cb()
          })
        })
      })
    })
  }

  buildIndexes (cb) {
    this.db = level(VIEWS(this.storage))
    this.core.use('query', Query(this.db, this.core, queryMfr))
    this.indexesReady = true
    if (this.key) return cb()
    this.core.ready(cb)
  }

  publishMessage (message, cb) {
    message.version = VERSION
    message.timestamp = Date.now()
    this.localFeed.append(message, cb)
  }

  publishId (name, cb) {
    if (typeof name === 'function' && !cb) return this.publishId(null, name)
    if (!this.key) return cb(new Error('no key, call ready()'))
    this.publishMessage({
      type: 'id',
      id: this.blsId,
      name
    }, cb)
  }

  publishContribution (callback) {
    try {
      const contribution = this.member.generateContribution()
    } catch (err) {
      return callback(err)
    }
    const self = this
    this.publishMessage({
      type: 'vvec',
      vvec: contribution.vvec
    }, (err) => {
      if (err) return callback(err)
      pull(
        pull.values(Object.keys(contribution.contrib)),
        pull.asyncMap((recp, cb) => {
          self.publishMessage({
            type: 'share-contribution',
            recipients: recp, // TODO: publish also to self? (this.blsId)
            shareContribution: contribution.contrib[recp]
          }, (err) => {
            if (err) return callback(err)
            cb()
          })
        }),
        pull.collect(callback)
      )
    })
  }

  queryIds (cb) {
    pull(
      this.query([{ $filter: { value: { type: 'id' } } }]),
      pull.filter(msg => schemas.isId(msg.value)),
      pull.drain((idMsg) => {
        if (this.recipients.indexOf(idMsg.key) < 0) this.recipients.push(idMsg.key)
        this.member.addMember(idMsg.value.id)
      }, cb)
    )
  }
  

  query (query, opts = {}) {
    if (!this.indexesReady) throw new Error('Indexes not ready, run buildIndexes')
    return pull(
      this.core.api.query.read(Object.assign(opts, { live: false, reverse: true, query }))
    )
  }
}
