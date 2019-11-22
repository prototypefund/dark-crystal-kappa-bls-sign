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
    this.recipients = {}
    this.threshold = threshold
    this.numMembers = numMembers
    this.storage = opts.storage || path.join(os.homedir(), STORAGE)
    this.isVvec = schemas.createIsVvec(threshold)

    this.core = kappa(
      FEEDS(this.storage),
      { valueEncoding: this.asymmetric.encoder() }
    )
  }

  ready (cb) {
    ThresholdSig.blsInit(() => {
      this.member = ThresholdSig(this.threshold, this.numMembers)
      const self = this
      this.core.writer(LOCAL_FEED, (err, feed) => {
        if (err) return cb(err)
        feed.ready(() => {
          self.localFeed = feed
          self.key = feed.key

          kappaPrivate.getSecretKey(FEEDS(self.storage), self.key, (err, secretKey) => {
            if (err) return cb(err)
            self.asymmetric.secretKey = secretKey
            self.blsId = self.member.initId(self.key)
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

  // *** Publish Methods ***

  publishMessage (message, cb) {
    message.version = VERSION
    // TODO: we should not need to explicity add author
    // the queries should give us the feedid as 'key' property
    message.author = this.key.toString('hex')
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
    let contribution
    try {
      contribution = this.member.generateContribution()
    } catch (err) {
      return callback(err)
    }
    const self = this
    this.publishMessage({
      type: 'vvec',
      id: self.blsId,
      vvec: contribution.vvec
    }, (err) => {
      if (err) return callback(err)
      pull(
        pull.values(Object.keys(contribution.contrib)),
        pull.asyncMap((id, cb) => {
          const recp = this.recipients[id]
          if (!recp) cb(new Error('No key for recipient'))
          self.publishMessage({
            type: 'share-contribution',
            id: self.blsId,
            recipients: [recp], // TODO: publish also to self? (this.blsId)
            shareContribution: contribution.contrib[id]
          }, (err) => {
            if (err) return callback(err)
            cb()
          })
        }),
        pull.collect(callback)
      )
    })
  }

  signMessage (message, callback) {
    // TODO: handle message as buffer - convert to Uint8Array
    if (typeof message === 'object') message = JSON.stringify(message)
    // todo: get hash of message
    const { signature } = this.member.sign(message)
    this.publishMessage({
      type: 'signature',
      id: this.blsId,
      message,
      signature
      // recipients: Object.values(this.recipients)
    }, callback)
  }



  // *** Queries ***

  query (query, opts = {}) {
    if (!this.indexesReady) throw new Error('Indexes not ready, run buildIndexes')
    return pull(
      this.core.api.query.read(Object.assign(opts, { live: false, reverse: true, query }))
    )
  }

  queryIds (callback) {
    pull(
      this.query([{ $filter: { value: { type: 'id' } } }]),
      pull.filter(msg => schemas.isId(msg.value)),
      pull.drain((idMsg) => {
        const author = idMsg.value.author // should be isMsg.key
        this.recipients[idMsg.value.id] = author
        // if (this.recipients.indexOf(author) < 0) this.recipients.push(author)
        this.member.addMember(idMsg.value.id)
      }, callback)
    )
  }

  queryContributions (callback) {
    const self = this
    pull(
      self.query([{ $filter: { value: { type: 'vvec' } } }]),
      pull.filter(msg => self.isVvec(msg.value)),
      pull.drain((vvecMsg) => {
        self.member.storeVerificationVector(vvecMsg.value.id, vvecMsg.value.vvec)
      }, () => {
        pull(
          self.query([{ $filter: { value: { type: 'share-contribution' } } }]),
          pull.filter(msg => schemas.isShareContribution(msg.value)),
          pull.drain((shareMsg) => {
            const { id, shareContribution } = shareMsg.value
            if (!self.member.recieveContribution(id, shareContribution)) {
              return callback(new Error(`Unable to verify share contribution from member id ${id}`))
            }
          }, callback)
        )
      })
    )
  }

  querySignatures (callback) {
    const self = this
    pull(
      self.query([{ $filter: { value: { type: 'signature' } } }]),
      pull.filter(msg => schemas.isSignature(msg.value)),
      pull.drain((msg) => {
        const { id, signature, message } = msg.value
        self.member.recieveSignature(signature, id, message)
      }, (err) => {
        if (err) return callback(err)
        console.log('verify group signatures: ', self.member.groupSignatures)
        callback()
      })
    )
  }

  replicate (...args) {
    return this.core.replicate(...args)
  }
}
