# Pisell 网页版

网页保留原有全球地图、区域案例、3D 照片轮播和案例编辑器，品牌配置及页面样式位于 `src/web/`，共用 `src/experience/` 中的组件。

## 放入现有网站

将 `pisell-web/build` 内的网页文件上传到网站的 `/pisell-atlas/` 目录。不要上传 `.git`、`.openai` 或 `source` 文件夹。网站需要通过 HTTP/HTTPS 提供文件，不能直接双击本地 HTML。

在需要的位置加入：

```html
<iframe
  src="/pisell-atlas/atlas.html?embed=1"
  title="Pisell 全球案例地图"
  style="width:100%;height:760px;border:0;border-radius:20px"
  loading="lazy"
  allow="fullscreen"
></iframe>
```

或者用自动插入组件的脚本：

```html
<script src="/pisell-atlas/embed.js" data-height="760" defer></script>
```

`index.html` 为完整 Pisell 风格预览页；`atlas.html` 为独立地图模块；`atlas.html?editor=1` 为案例编辑入口。部署到子目录时图片、模型和数据仍采用相对路径，无须修改。

## 独立录入页面

`admin.html` 为项目合集，`admin.html?new=1` 为完整新增页面。原 Case editor 中的 Add new 也会进入这个页面。支持项目名称、Google Maps 地点链接与地址、面积、年份、七种项目类型，以及图片上传、预览、封面选择和调整顺序。

Cloudflare 版本使用 D1 保存项目资料、R2 保存图片，见 [CLOUDFLARE.md](CLOUDFLARE.md)。Google Maps 自动搜索需配置地图密钥。管理页面可单独打开，展示地图仍使用固定 iframe 地址。

手机端有「选择图片」与「拍摄照片」两个入口。选择后立即预览，保存项目时统一上传图片、保存资料。未连接数据库的静态预览不支持保存；不会将案例保存到浏览器。

## 更新案例

打开 `admin.html`，选择项目或点击 Add new。填写资料并保存后，所有刷新地图的访客都会读取更新。原 Case editor 中点击「编辑详情」可进入同一个完整页面；该列表不再单独写入浏览器数据。

## 内容与样式

大图默认以 20 秒从 100% 放大到 120%，再缓慢缩回；切换图片重置。系统开启减少动态效果时保持静止。Street map 支持地址搜索、国家筛选和位置聚合。

当前收录 26 个已上线或使用中的客户，展示 28 个位置、45 张图片。上海 Tada 使用亦玩游乐总部地址；Cashee、Eco Share Project、FC Group、365 天天团购已按要求排除。连锁展示点、总部、联系地址和商场位置均在详情标注。图片包括门店、产品及品牌资料，详情提供来源链接。

Pisell logo、粉橙渐变及橙红强调色参考官网；地标来源和授权信息可在右上角 Artwork credits 查看，相关许可文件随包提供。

运行 `node scripts/build-pisell.cjs` 可重新生成网页文件。构建统一读取 `src/web/data/customers.json` 和 `src/web/assets/customers/`，同步生成 `pisell-web/build`。不会重新导入旧演示案例。
