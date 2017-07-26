/*global __dirname,require*/

'use strict'

const cheerio = require('cheerio')
const fetch = require('node-fetch')
const ImgixClient = require('imgix-core-js')
const Koa = require('koa')
const path = require('path')
const Router = require('koa-router')
const serve = require('koa-static')
const views = require('koa-views')

const app = new Koa()
const router = new Router()

const client = new ImgixClient({
  host: 'attn2.imgix.net'
})

app.use(serve(path.join(__dirname, 'assets')))

app.use(views(path.join(__dirname, 'views'), {
  extension: 'pug'
}))

router.get('/', async function (ctx) {
  const items = await getStories()
  const limit = 6
  const next = 2

  await ctx.render('index', { items, limit, next })
})

router.get('/stories/:id/:title?', async function (ctx) {
  const id = ctx.params.id
  const story = await getStory(id)
  await ctx.render('story', { story })
})

router.get('/stories.html', async function (ctx) {
  const qs = ctx.request.query
  const limit = qs.limit
  const page = qs.page
  const next = Number(page) + 1

  const items = await getStories(limit, page)

  await ctx.render('partials/resource-list', { items, limit, next })
})

app
  .use(router.routes())
  .use(router.allowedMethods())
  .listen(3000)

async function getStories (limit = 6, page = 1) {
  const url = `https://content.attn.com/api/stories?limit=${limit}&page=${page}`
  const res = await fetch(url)
  const json = await res.json()

  const items = json.map(item => {
    const filePath = item.image_url.split('/').pop()
    item.imgix_url = client.buildURL(filePath, {
      auto: 'format',
      fit: 'crop',
      h: 204,
      w: 388,
      q: 60
    })
    return item
  })

  return items
}

async function getStory (id) {
  const url = `https://content.attn.com/api/stories/${id}`
  const res = await fetch(url)
  const json = await res.json()

  const $ = cheerio.load(json.body)

  $('img').each(function () {
    const el = $(this)
    const src = el.attr('src')
    const filePath = src.split('/').pop()

    const imgixUrl = client.buildURL(filePath, {
      auto: 'format',
      fit: 'crop',
      'max-w': 768
    })

    el.attr('src', imgixUrl)

    return el
  })

  json.body = $.html()

  return json
}
