# [掘金沸点客户端](https://juejin.im/pins/recommended)

掘金沸点 Mac/Windows 客户端。(非官方) `每次五分钟，摸鱼好轻松`

## 功能

本软件可以：

- 提供流畅的阅读体验
- 打开高清图片和视频

## 效果预览

第一次运行可能需要在「系统偏好设置」→「安全性与隐私」中点击允许。

<img width="800" alt="screenshot" src="http://ww1.sinaimg.cn/large/6db4aff6ly1g47rfx3h4ej20ea0lw7a1.jpg">


## 键盘快捷键

- `j`/`↓` 去下一条沸点
- `k`/`↑` 去上一条沸点
- `g` 去时间线顶部（再按一次返回原位置）
- `m` 折叠沸点
- `i` 查看图片
- `space`/`enter` 查看沸点详情
- `esc` 关闭图片或评论窗口
- `h`/`←` 前一张图片
- `l`/`→` 后一张图片

## 构建方法

本软件使用 [Electron](https://electronjs.org) 框架，在 macOS 与 Windows 系统上均可构建。

1. 安装 [`yarn`](https://yarnpkg.com/lang/en/docs/install/)
2. `$ cd FeidianElectron/`
3. `$ yarn install`
4. 使用 `$ yarn start` 直接启动程序，或 `$ yarn dist --mac --win` 生成对应两个系统的可执行程序

## 致谢
- 此项目基于[zhihu-heartbeat](https://github.com/apm1467/zhihu-heartbeat) 修改而来
