import test from 'node:test'
import assert from 'node:assert/strict'
import { app } from '../src/app.js'

test('chat opens only after mutual interest or accepted request',async()=>{
 const server=app.listen(0,'127.0.0.1')
 await new Promise((resolve)=>server.once('listening',resolve))
 const base=`http://127.0.0.1:${server.address().port}/api`
 async function call(path,token,body,method='POST'){
  const response=await fetch(base+path,{method,headers:{'content-type':'application/json',...(token?{authorization:`Bearer ${token}`}:{})},...(body?{body:JSON.stringify(body)}:{})})
  return {status:response.status,body:await response.json()}
 }
 try{
  const a=(await call('/auth/login',null,{email:'natcha@demo.com',password:'demo1234'})).body.token
  const b=(await call('/auth/login',null,{email:'kanittha@demo.com',password:'demo1234'})).body.token
  assert.equal((await call('/conversations',a,{peerId:'user-kanittha'})).status,403)
  await call('/swipes',a,{bookId:'book-math',preference:'LIKE'})
  assert.equal((await call('/conversations',a,{peerId:'user-kanittha'})).status,403)
  const liked=await call('/swipes',b,{bookId:'book-tgat',preference:'LIKE'})
  assert.equal(liked.body.matched,true)
  const room=await call('/conversations',a,{peerId:'user-kanittha'})
  assert.equal(room.status,200)
  const id=room.body.conversation.id
  assert.equal((await call(`/conversations/${id}/messages`,a,{text:'Meet at library'})).status,201)
  assert.equal((await call(`/conversations/${id}/messages`,b,null,'GET')).body.messages.length,1)
  assert.equal((await call(`/conversations/${id}/messages`,null,null,'GET')).status,401)
  await call('/swipes',b,{bookId:'book-tgat',preference:'DISLIKE'})
  const request=await call('/exchange-requests',a,{offeredBookId:'book-tgat',requestedBookId:'book-biology',loanDays:7,meetingPlace:'Library',meetingAt:new Date(Date.now()+86400000).toISOString()})
  assert.equal(request.status,201)
  assert.equal((await call(`/exchange-requests/${request.body.request.id}/status`,b,{status:'ACCEPTED'},'PATCH')).status,200)
  assert.equal((await call('/conversations',a,{peerId:'user-kanittha'})).status,200)
 }finally{await new Promise((resolve)=>server.close(resolve))}
})
