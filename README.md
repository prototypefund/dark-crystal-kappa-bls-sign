# kappa-bls-sign

Use BLS group threshold signatures over [kappa-core](https://github.com/kappa-db/kappa-core)

## API

```js
const KappaBlsSign = require('.')

const signer = KappaBlsSign(threshold, numberOfMemebers, { storage: storageDir })
```
Create a `signer` instance.
- `threshold` - minimum number of signing members, eg: 3
- `numberOfMembers` - number of members of the group, eg: 5
- `storageDir` - path to store database.
    

```js
signer.ready(callback)
```
`callback` is called when key has been generated and database set up.

```js
signer.buildIndexes(callback)
```
`callback` is called when indexes are ready. Queries cannot be made beforehand.

### BLS ids

```js
signer.blsId
```
Returns the signers bls id, their unique identifier as a group member.

```js
signer.publishId(name, callback)
```
Publish the BLS id publicly. 
- `name` an optional name to be known by. eg: `'Alice'`

```js
signer.queryIds(callback)
```
```js
signer.recipients 
```
An object which maps BLS ids to feed ids,

### Share contributions

These are used in the initial setup phase.

```js
signer.publishContribution(callback)
```
publish:
- a verification vector, publicly
- a secret key contribution for each other group member, privately (separate messages encrypted to each other member).

```js
signer.queryContributions(callback)
```
Query both verification vectors (`vvec` messages) and share contributions (`share-contribution` messages).
Share contributions are also validated, and if any are found to be invalid and error is returned in the callback.

### Signing

```js
signer.signMessage(message, cb)
```
Publish a `signature` message including a signature for the given message.

```js
signer.querySignatures(cb)
```
Query all signature messages from all group members and attempt to verify any for which the threshold is reached.

## Message types:

### public:

#### id

```
{
  type: 'id',
  id: bls id encoded to hex
  timestamp
  version
  name: optional name
}
```
#### vvec
```
{
  type: 'vvec',
  vvec: array of hex encoded strings of length threshold
  timestamp
  version
}
```

### private:

#### share-contribution
```
{
  type: 'share-contribution'
  shareContribution: hex encoded string
  timestamp
  version
}
```
#### signature
```
{
  type: signature
  signature: hex encoded string
  timestamp
  version
  message:
}
```
