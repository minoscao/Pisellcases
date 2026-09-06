# Pisell Cases

Pisell 客户案例地图与独立录入页面。包括 3D 全球地图、街道地图、案例图片浏览和 iframe 嵌入。

## 使用

```sh
npm ci
npm run build:web
npm run preview:web
```

打开 `http://127.0.0.1:4191/`。

| 页面 | 地址 |
| --- | --- |
| Pisell 完整展示 | `/index.html` |
| 独立地图 / iframe | `/atlas.html?embed=1` |
| 项目管理 | `/admin.html` |
| 新增项目 | `/admin.html?new=1` |
| 编辑项目 | `/admin.html?id=项目编号` |

点击 **Add new** 打开完整页面，填写项目名称、地址、面积、年份和类型，通过「选择图片」或「拍摄照片」添加图片，预览、选择封面并保存。手机拍摄入口使用系统摄像头，保存时将图片上传 R2、项目资料写入 D1。图片大图缓慢从 100% 缩放到 120%，支持减少动态效果设置。

静态预览可以填写和预览，但不保存。**正式保存统一使用 Cloudflare Workers + D1 + R2**，详情见 [Cloudflare 部署说明](CLOUDFLARE.md)。Google Maps 自动补全需要配置自己的地图密钥；未配置时可粘贴完整地点链接或手动录入坐标。

## 维护位置

| 内容 | 文件 |
| --- | --- |
| 初始客户资料 | `src/web/data/customers.json` |
| 初始客户图片 | `src/web/assets/customers/` |
| 类型和校验规则 | `src/web/case-model.mjs` |
| 独立录入页 | `src/web/admin.html`、`admin.js`、`admin.css` |
| 共用存储方式 | `src/web/library.mjs` |
| 品牌样式与配置 | `src/web/pisell.css`、`profile.js` |
| 地图、轮播、编辑器组件 | `src/experience/` |
| Cloudflare 接口与资料结构 | `cloudflare/` |

网页构建输出到 `pisell-web/build/`。该目录为生成内容，不提交 Git；源代码和初始资源足以重新构建。

初始资料：26 个已上线或使用中的客户，28 个展示位置，45 张图片。图片、坐标和门店信息来源保留在客户资料中；地标模型的署名和许可见 `src/assets/landmarks/` 与页面的 Artwork credits。此仓库不包含原始客户跟进表或内部跟进记录。第三方素材的权利归各自权利人。

```sh
npm run test:web
```

本项目由既有案例地图组件复用扩展；`build` 和 `build:web` 均构建 Pisell 网页。iframe 接入细节见 [PISELL-INTEGRATION.md](PISELL-INTEGRATION.md)。
