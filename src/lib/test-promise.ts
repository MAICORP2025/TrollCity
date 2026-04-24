// Test file to verify Promise.race syntax
const _test = Promise.race([
  Promise.resolve('first'),
  new Promise((_, reject) => {
    setTimeout(() => reject(new Error('timeout')), 1000)
  })
]);