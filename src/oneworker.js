addEventListener('message', e => {
  console.log(e)
  for (let i = 0; i < 10000000000; i++) {
    1 * 2
  }
  console.log('worker循环完毕')
  console.log(e, Date.now())
})