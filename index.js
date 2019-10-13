const kappa = require('kappa-core')
const kappaPrivate = require('kappa-private')
const level = require('level')
const Query = require('kappa-view-pull-query')
const pull = require('pull-stream')

const LOCAL_FEED = 'local'
const FEEDS = (dir) => path.join(dir, 'feeds')
const VIEWS = (dir) => path.join(dir, 'views')

class KappaBls {
  constructor (opts = {}) {
    this.indexesReady = false
    this.asymmetric = new kappaPrivate.Asymmetric()

    this.shares = {}
    this.peerNames = {}
    this.repliedTo = []

    this.core = kappa(
      FEEDS(this.storage),
      { valueEncoding: this.asymmetric.encoder() }
    )
  }

  ready (cb) {
    this.core.writer(LOCAL_FEED, (err, feed) => {
      if (err) return cb(err)
      feed.ready(() => {
        this.localFeed = feed
        this.key = feed.key
        kappaPrivate.getSecretKey(FEEDS(this.storage), this.key, (err, secretKey) => {
          if (err) return cb(err)
          this.asymmetric.secretKey = secretKey
          cb()
        })
      })
    })
  }

  buildIndexes (cb) {
    this.db = level(VIEWS(this.metaDbPath))
    this.core.use('query', Query(this.db, this.core, queryMfr))
    this.core.ready(() => {
      // should we do if (this.key)
      this.indexesReady = true
      cb()
    })
  }

