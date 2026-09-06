# Cloudflare 部署

项目使用 Workers 提供网页和接口、D1 保存项目资料、R2 保存新增图片。初始的 28 个展示位置与 45 张图片随网页部署，不需要先导入数据库。D1 保存新增内容和对初始案例的修改，同一份内容供管理页面和嵌入地图读取。

## 1. 安装与构建

需要 Node.js 22 或更新版本。

```sh
npm ci
npm run build:web
```

静态预览：`npm run preview:web`，打开 `http://127.0.0.1:4191/admin.html?new=1`。此模式仅预览，保存按钮会提示尚未连接服务。不会使用浏览器数据库。

## 2. 创建存储

登录自己的 Cloudflare 账号，并执行：

```sh
npx wrangler login
npx wrangler d1 create pisell-cases
npx wrangler r2 bucket create pisell-case-photos
```

将创建数据库返回的真实 `database_id` 填入 `wrangler.jsonc`。若使用已有资源，同时修改资源名称。不要使用示例中的全零数据库编号进行生产部署。

```sh
npx wrangler d1 migrations apply pisell-cases --remote
```

图片通过 Worker 校验后写入 R2，不需要向浏览器提供 R2 访问密钥。图片采用随机名称，通过 `/media/photos/...` 读取。单张限制 10 MB，单个项目最多 24 张，支持 JPG、PNG、WebP。

## 3. 管理登录

在 Cloudflare Zero Trust 中创建一个自托管 Access 应用，仅允许负责维护的人员登录。将同一应用覆盖到站点的下列路径：

- `/admin`、`/admin.html` 和 `/admin/*`
- `/api/photos`
- `/api/cases/*`

保持 `GET /api/cases`、`/api/config`、`/media/*`、`/atlas.html` 和展示资源可由访客读取，避免访客浏览 iframe 时被要求登录。地图读取接口和写入接口路径不同。

填写 `wrangler.jsonc` 中的 `ACCESS_TEAM_DOMAIN`（如 `your-team.cloudflareaccess.com`）和 `ACCESS_AUD`（此应用的 AUD）。Worker 会验证登录凭证签名、签发方、受众和有效期；不是仅检查某个请求头是否存在。未配置管理登录时写入默认关闭，访客仍可浏览已有案例。

本地验证可以复制 `.dev.vars.example` 为 `.dev.vars`，然后执行：

```sh
npx wrangler d1 migrations apply pisell-cases --local
npm run dev:cloudflare
```

`LOCAL_DEV=true` 仅用于本机回环地址，不能填入生产环境配置。`.dev.vars` 已排除在 Git 之外。

## 4. Google Maps

在 Google Cloud 项目中启用 Maps JavaScript API 和 Places API (New)，配置浏览器密钥，填入 `GOOGLE_MAPS_API_KEY`。启用所需的计费设置，并将密钥限制到管理页面所在域名及这两项服务。浏览器地图密钥会下发给网页，不能在这里填写服务器密钥。

如有自己的地图样式 ID，可填写 `GOOGLE_MAPS_MAP_ID`。未填写时使用 Google 的演示 Map ID，正式运行建议设置自己的地图 ID。

配置后，录入页通过 Google 的 `PlaceAutocompleteElement` 搜索门店，选择结果会填写地址、国家、城市、经纬度和地点 ID，并在 Google 地图显示位置。可拖动标记调整坐标。

没有配置地图密钥时，可以使用完整 Google Maps 地点链接中的地点坐标，或手动填写经纬度。短链接需先在浏览器打开后复制完整链接；仅含 `@lat,lng` 的地图视角链接不会被误当作门店位置。

参考：[Google 地点自动补全](https://developers.google.com/maps/documentation/javascript/place-autocomplete-new)、[Cloudflare 登录验证](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/)、[Workers 静态资源](https://developers.cloudflare.com/workers/static-assets/)。

## 5. 发布

```sh
npm run deploy:cloudflare
```

也可以在 Cloudflare Workers Builds 连接此 GitHub 仓库，使用 `npm run build:web` 作为构建命令、`npx wrangler deploy` 作为部署命令。首次部署前仍需完成存储与登录配置。此仓库尚未绑定你的 Cloudflare 账号或域名。

独立管理入口：`https://你的域名/admin.html`

直接新增：`https://你的域名/admin.html?new=1`

网站嵌入：

```html
<iframe
  src="https://你的域名/atlas.html?embed=1"
  title="Pisell 客户案例地图"
  style="display:block;width:100%;height:760px;border:0;border-radius:20px"
  loading="lazy"
  allow="fullscreen"
></iframe>
```

不要对展示地图设置 `X-Frame-Options: SAMEORIGIN`。如果主网站限制 iframe 来源，需要将地图域名加入主网站的 `frame-src`。管理页面单独限制嵌入。

以后保存项目即可更新 D1 内容，图片保存到 R2；访问者刷新地图后看到新内容，不需要重新构建网站。调整布局或功能时，再更新 GitHub 并重新部署。已打开的地图不会自动实时刷新。

## 验证与维护

```sh
npm run build:web
npm run test:web
```

完整存储验证仅在隔离的本地 Wrangler 环境运行：启动 `npx wrangler dev --ip 127.0.0.1 --port 4192 --var LOCAL_DEV:true` 后运行 `node tests/cloudflare.integration.mjs`。验证会写入本地测试案例和图片，不连接生产数据库。

所有保存均通过 Worker 写入 D1，图片在保存项目时上传 R2。选择图片和拍摄照片仅在当前表单中生成临时预览，离开未保存页面会提示；不会使用 IndexedDB 或 localStorage 保存案例。另一位维护人员已更新同一项目时，会提示刷新，避免覆盖。

手机端提供两个独立文件输入：「选择图片」支持相册/文件多选；「拍摄照片」使用 `accept="image/*" capture="environment"` 请求系统后置摄像头。相机界面由手机浏览器及系统提供；桌面浏览器通常显示文件选择器。两种入口复用相同的图片校验、封面、预览和上传流程。

从表单移除图片只会移除项目引用，不自动删除 R2 文件，避免影响仍在编辑的页面。定期清理无引用的上传文件前应先检查数据库引用，并保留必要备份。
