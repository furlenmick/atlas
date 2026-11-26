---
id: 3
title: "小米 AX3600 刷 OpenWrt 做旁路由完整教程（定版）"
category: "网络与路由"
tags: ["AX3600", "OpenWrt", "OpenClash", "AdGuardHome", "旁路由"]
pinned: true
cover_key: ax3600-openwrt
summary: "BE7200 Pro 当主路由、AX3600 刷 OpenWrt 做旁路由的完整定版教程：降级开 SSH、刷机、OpenClash 分流与 AdGuardHome 去广告，全程可照着走通。"
source_note: "来源：your_files/AX3600旁路由完整教程.md（294 行定版）。早期草稿《小米AX3600刷OpenWrt旁路由教程.md》内容已被定版覆盖，不单独收录。"
updated_at: "2026-11-26T04:51:42.795Z"
---

# 小米 AX3600 刷 OpenWrt 做旁路由（OpenClash + AdGuardHome）完整教程

> 目标：BE7200 Pro 继续当主路由（拨号 + WiFi），闲置的 AX3600 刷 OpenWrt 后做**旁路由**，
> 承担代理分流（OpenClash）和去广告 DNS（AdGuardHome）。
> 想走软路由的设备把网关/DNS 指向它，不想走的设备完全不受影响。

## 0. 先看懂拓扑（动手前花 2 分钟）

```
光猫 ── BE7200 Pro（主路由，192.168.31.1，管拨号和 WiFi）
          │
          │ 网线（LAN 口对 LAN 口，AX3600 的 WAN 口空着不用）
          │
        AX3600（旁路由，192.168.31.2，WiFi 关闭）
```

- 你的手机/电脑想走软路由时：手动把网关设为 192.168.31.2，DNS 设为 192.168.31.2。
- 数据流向：设备 → AX3600（Clash 分流 / AdGuardHome 过滤）→ BE7200 Pro → 光猫 → 外网。
- 全程用**网线**把电脑连 AX3600 操作，不要用 WiFi 刷机。

**需要准备**：AX3600 及电源、一根网线、一台 Win11 电脑（自带 `ssh`/`scp` 命令）。

---

## 1. 恢复出厂，确认固件版本

1. AX3600 通电，**不接任何网线**。长按机身 Reset 孔 5 秒以上，看到指示灯变橙色后松手，等待 2~3 分钟重启完成。
2. 电脑用网线连 AX3600 的 **LAN 口**（4 个口随便一个，别插 WAN 口）。
3. 浏览器打开 `http://192.168.31.1`，按初始化向导随便设个 WiFi 名和管理密码（管理密码记下来，后面降级登录要用）。
4. 进后台看固件版本（一般在"系统状态"或"路由设置→系统升级"里）。
   - 如果版本是 **1.0.17**：直接跳到第 3 步。
   - 如果版本**高于** 1.0.17：必须先降级，看第 2 步。（开 SSH 用的漏洞在新版里已经被堵上了）

---

## 2.（仅高版本需要）降级到 1.0.17

1. 在电脑上下载降级固件（小米官方 CDN 直链，已验证可访问，纯文本长按复制）：
   `https://cdn.cnbj1.fds.api.mi-img.com/xiaoqiang/rom/r3600/miwifi_r3600_firmware_5da25_1.0.17.bin`
   - 文件名：`miwifi_r3600_firmware_5da25_1.0.17.bin`
   - 大小：**28,312,508 字节**（约 27.0 MiB）。下完对一下大小，差一位都别用。
2. 浏览器登录 `http://192.168.31.1`，登录后看地址栏，把 `stok=` 后面那一长串字符复制下来（后面也要用）。
3. 在浏览器地址栏粘贴（把 `<STOK>` 换成你刚复制的那串）：
   `http://192.168.31.1/cgi-bin/luci/;stok=<STOK>/web/setting/upgrade`
   这是"手动升级"页面。点"选择文件"，上传第 1 步下载的 bin，开始升级。
4. 等待 3~5 分钟，指示灯变蓝常亮表示完成。浏览器重新打开 `http://192.168.31.1` 登录。
   （如果提示密码不对，用你第 1 步里设的管理密码；实在不行 Reset 重来一次。）

---

## 3. 一键开启 SSH

1. 登录 `http://192.168.31.1`，从地址栏复制新的 `stok=` 后面的字符串。
2. 把下面这串地址里的 `<STOK>` 替换掉，在**浏览器地址栏**粘贴后回车（纯文本，长按复制）：
   `http://192.168.31.1/cgi-bin/luci/;stok=<STOK>/api/xqsystem/upgrade_rom?url=%3Bnvram%20set%20ssh_en%3D1%3Bnvram%20commit%3Bsed%20-i%20%27s%2Fchannel%3D.*%2Fchannel%3D%22debug%22%2Fg%27%20%2Fetc%2Finit.d%2Fdropbear%3B%2Fetc%2Finit.d%2Fdropbear%20start%3Becho%20-e%20[密码已隐藏]%7Cpasswd%20root%3B`
3. 页面返回 `{"code":0}` 即成功。这串命令一次做完四件事：打开 SSH 开关并保存、启动 SSH 服务、把 root 密码设为你自己设定的密码（[密码已隐藏]）。
4. 在电脑上按 `Win+R` 输入 `cmd` 回车，输入：
   `ssh root@192.168.31.1`
   提示输入密码时输入你设置的密码（输入时不显示，输完回车）。看到 `root@XiaoQiang:~#` 就表示进去了。
5. **如果 root 密码登不上**：说明密码没设成功。备选方案是去网上搜"小米路由器 SSH 密码计算器"，输入机身标签上的 SN 算出密码再登。算出来也登不上就回到第 1 步重来（多半是固件版本不对）。

---

## 4. 备份重要分区（5 分钟，变砖保险）

在刚才的 SSH 窗口里逐行执行：

```
cd /tmp
nanddump -f mtd8-art.bin /dev/mtd8
nanddump -f mtd9-bdata.bin /dev/mtd9
nanddump -f mtd10-crash.bin /dev/mtd10
ls -lh mtd*.bin
```

- mtd8 是 ART（WiFi 射频校准数据，丢了 WiFi 就残了），mtd9 是 bdata（设备身份信息），mtd10 是 crash。
- 然后在**电脑的 cmd** 里（不是 SSH 里）执行，把备份拉回电脑妥善保存：
  `scp root@192.168.31.1:/tmp/mtd*.bin D:\backup\ax3600\`
  （先在 D 盘建好 `D:\backup\ax3600` 文件夹；密码还是你设置的那个；第一次会问 `yes/no`，输 `yes`。）

---

## 5. 下载 OpenWrt 固件

打开 `https://firmware-selector.openwrt.org/`，搜索框输入 `ax3600`，版本选 **25.12.6**（当前稳定版；24.10 系列已于 2026-09-30 停止安全更新，不建议再用），下载下面两个文件：

| 文件 | 大小 | SHA256（下载后可校验） |
|---|---|---|
| `openwrt-25.12.6-qualcommax-ipq807x-xiaomi_ax3600-initramfs-factory.ubi` | 14,942,208 字节（约 14.25 MiB） | `994f415609a058ee44ab4fa92712c0cdb4e754aabb0abb0a70a0d0d9652ec357` |
| `openwrt-25.12.6-qualcommax-ipq807x-xiaomi_ax3600-squashfs-sysupgrade.bin` | 13,568,307 字节（约 12.94 MiB） | `b4d26d71e913a12e9f35a362cc360d8de9e513563b8bbe1e7c8dc43796726729` |

> 注意：24.10 开始 AX3600 的 target 从 `ipq807x/generic` 改成了 `qualcommax/ipq807x`，
> 老教程里的旧版文件名对不上是正常的，认准 `qualcommax-ipq807x-xiaomi_ax3600` 就行。

---

## 6. 刷入 OpenWrt（分两步，约 10 分钟）

### 6.1 把过渡镜像传进路由器并改短文件名

在电脑 cmd 里：

```
scp D:\openwrt\openwrt-25.12.6-qualcommax-ipq807x-xiaomi_ax3600-initramfs-factory.ubi root@192.168.31.1:/tmp/factory.ubi
```

（把 `D:\openwrt\` 换成你实际存放固件的文件夹。）

### 6.2 查当前启动分区，刷入非当前分区

SSH 登录路由器，执行：

```
fw_printenv flag_boot_rootfs
```

看返回结果，二选一执行（**不要两组都执行**）：

- 如果返回 `flag_boot_rootfs=1`，执行：
```
ubiformat /dev/mtd12 -y -f /tmp/factory.ubi -s 2048 -O 2048
fw_setenv flag_boot_rootfs 0
fw_setenv flag_last_success 0
reboot
```
- 如果返回 `flag_boot_rootfs=0`，执行：
```
ubiformat /dev/mtd13 -y -f /tmp/factory.ubi -s 2048 -O 2048
fw_setenv flag_boot_rootfs 1
fw_setenv flag_last_success 1
reboot
```

原理：AX3600 有双系统分区，这一步只写**当前没在用的那个分区**，先让 OpenWrt 从内存里跑起来验证一遍。
这一步如果失败，原厂系统还完整躺在另一个分区里，有机会切回去。
注意：下一步 6.3 正式安装完成后，OpenWrt 会把两个分区合并成一个大分区使用，
原厂就不再保留在机器里了——届时恢复原厂走第 11 步的官方修复工具，别指望双分区兜底。

### 6.3 进内存中的 OpenWrt，正式安装

1. 等待 2~3 分钟（指示灯变蓝）。**电脑网线仍然直连 AX3600**，浏览器打开 `http://192.168.1.1`
   （注意：这时 IP 变成了 192.168.1.1，不是 192.168.31.1）。
2. 第一次进会让你设 root 密码，设一个自己记得住的。
3. 在电脑 cmd 里把正式固件传进去并改短名：
   `scp D:\openwrt\openwrt-25.12.6-qualcommax-ipq807x-xiaomi_ax3600-squashfs-sysupgrade.bin root@192.168.1.1:/tmp/sysupgrade.bin`
4. SSH 登录（`ssh root@192.168.1.1`，用刚设的密码），执行：
   `sysupgrade -n /tmp/sysupgrade.bin`
5. 等待 3 分钟左右，OpenWrt 正式装好。至此刷机完成。

---

## 7. 设为旁路由（基础网络配置）

1. 电脑**仍然网线直连 AX3600**，浏览器打开 `http://192.168.1.1` 登录。
2. 网络 → 接口 → LAN → 修改 → 基本设置，改成：
   - IPv4 地址：`192.168.31.2`
   - IPv4 子网掩码：`255.255.255.0`
   - IPv4 网关：`192.168.31.1`（你的 BE7200 Pro）
   - 使用自定义的 DNS 服务器：`192.168.31.1`（先这样，第 9 步会改成 127.0.0.1）
3. 同一页面下方"DHCP 服务器" → 基本设置 → **勾选"忽略此接口"**（DHCP 继续由 BE7200 Pro 负责）。
4. 点"保存"，再点"保存并应用"。页面会转圈然后断开——**这是正常的**，因为 IP 已经变了。
5. 现在接线：**AX3600 的 LAN 口** 用网线连到 **BE7200 Pro 的 LAN 口**（AX3600 的 WAN 口永远空着）。
   电脑的网线也改插到 BE7200 Pro 上（或连 BE7200 Pro 的 WiFi）。
6. 浏览器打开 `http://192.168.31.2`，能登录就说明旁路由网络通了。
7. 关 WiFi：网络 → 无线，把 2.4G 和 5G 的两个无线网络都点"禁用"（WiFi 交给 BE7200 Pro，AX3600 只当网关）。
8. 换国内软件源（官方源在国内很慢），SSH 里执行：
```
cat /etc/apk/repositories
sed -i 's|downloads.openwrt.org|mirrors.ustc.edu.cn/openwrt|g' /etc/apk/repositories
cat /etc/apk/repositories
apk update
```
   第二次 `cat` 确认地址已经变成 `mirrors.ustc.edu.cn/openwrt` 开头，`apk update` 不报错即可。

---

## 8. 安装 AdGuardHome（去广告 DNS）

1. SSH 里执行：
   `apk add adguardhome luci-app-adguardhome`
   - 如果提示找不到这两个包，停下来告诉我，我给你手动安装官方二进制包的步骤（不需要重来）。
2. 把 53 端口让给 AdGuardHome（OpenWrt 自带的 dnsmasq 默认占着 53）：
```
uci set dhcp.@dnsmasq[0].port='0'
uci commit dhcp
/etc/init.d/dnsmasq restart
/etc/init.d/adguardhome restart
ss -lntp | grep ':53 '
```
   最后一条命令应该能看到 `adguardhome` 在监听 53 端口。
3. 浏览器打开 `http://192.168.31.2:3000` 按向导走：
   - 网页管理界面端口：3000（默认）
   - DNS 服务器端口：53（默认）
   - 设置管理用户名和密码（自己记好）
   - 上游 DNS 服务器：**先填 `223.5.5.5`**（装完 OpenClash 后再改成 Clash 的 7874 端口，先填个能用的）
4. 进 AdGuardHome 的"设置 → DNS 设置"：Bootstrap DNS 填 `223.5.5.5`，保存。

---

## 9. 安装 OpenClash（代理分流）

### 9.1 下载安装包

OpenClash 的 GitHub Releases 页（仓库 `vernesong/OpenClash`），下载当前最新版 **v0.48.002** 的 apk 包：
`luci-app-openclash-0.48.002.apk`，大小 **10,702,048 字节**（约 10.21 MiB）。
（25.12 用 apk 包管理器，`.apk` 和 `.ipk` 别下混。）

### 9.2 安装依赖和主程序

把 apk 传到路由器 `/tmp`（用 scp 或 WinSCP 拖进去），SSH 里执行：

```
apk add dnsmasq-full
apk add bash curl ca-bundle kmod-tun kmod-nft-tproxy
apk add --allow-untrusted /tmp/luci-app-openclash-0.48.002.apk
```

说明：
- `dnsmasq-full` 是 OpenClash 安装检查要的完整版 dnsmasq，会替换掉精简版（我们已经把它的 DNS 关了、DHCP 也没开，替换很安全）。
- `--allow-untrusted` 是因为这个包不是官方源签名的，只对你确认过的文件用。
- 装完刷新 LuCI，左侧菜单出现"服务 → OpenClash"即成功。

### 9.3 下载 Clash 内核

服务 → OpenClash → 全局设置 → 版本更新 → 内核下载：
- 内核选 **Meta（mihomo）**，架构选 **linux-arm64**（AX3600 是 ARM64），点下载，等待完成。
- 如果路由器上下载 GitHub 很慢/失败：用电脑从 OpenClash 的 Releases 页下好对应内核文件，
  通过"全局设置 → 版本更新 → 上传内核"传上去也行。

### 9.4 导入订阅并启动

1. 全局设置 → 配置文件订阅 → 新增：粘贴你的机场订阅链接（或你自己的 vless 订阅），保存。
2. 点"更新订阅"，等节点列表出来。
3. 回到"运行状态"/"配置文件管理"，选中刚更新的配置文件。
4. **DNS 设置（关键，决定会不会断网）**：
   - 本地 DNS 劫持：启用
   - Fake-IP：启用
   - NameServer：填 `223.5.5.5`（多个用英文逗号隔开；**千万不要填 127.0.0.1**，否则和 AdGuardHome 互相指形成死循环）
5. 模式设置：运行模式保持"规则"即可，先别开 TUN。
6. 点"启动"。状态页显示运行中即成功。

### 9.5 把 AdGuardHome 的上游接到 Clash

回到 `http://192.168.31.2:3000` → 设置 → DNS 设置：
- 上游 DNS 服务器改成：`127.0.0.1:7874`（这就是 OpenClash 的 Fake-IP DNS 端口）
- 保存。

最终 DNS 链路：**设备 → AdGuardHome(:53，去广告) → OpenClash(:7874，按规则分流) → 真实 DNS**。
代理节点的域名由 Clash 用你填的 223.5.5.5 直接解析，不经过 AdGuardHome，没有循环。

### 9.6 让路由器自身也走这条 DNS

网络 → 接口 → LAN → 修改 → 基本设置 → 自定义 DNS 服务器改成 `127.0.0.1`，保存并应用。

---

## 10. 设备接入 & 验证

1. 在想走软路由的设备上手动设置（以电脑为例）：
   - IP：192.168.31.x（x 取 100~200 之间没被占用的）
   - 子网掩码：255.255.255.0
   - 网关：**192.168.31.2**
   - DNS：**192.168.31.2**
2. 验证三件套：
   - 能正常打开网页 → 旁路由转发通了。
   - 打开 AdGuardHome 首页（`http://192.168.31.2:3000`），"查询日志"里有这台设备的记录，且拦截计数在涨 → 去广告生效。
   - 在 Clash 里切到"全局"模式后访问 `ip.sb`，显示的 IP 变成节点 IP → 代理生效；切回"规则"模式，国内网站直连速度正常。
3. 不想走的设备：什么都不用改，网关/DNS 保持自动（走 BE7200 Pro），完全不受影响。

---

## 11. 回滚与救砖

- **升级 OpenWrt**：去固件选择器下新版 `squashfs-sysupgrade.bin`，LuCI 里系统 → 备份/升级 → 刷写即可（可保留配置）。
- **过渡阶段起不来（6.2 之后、6.3 之前）**：原厂还完整躺在另一个分区里，
  断电重启多试几次，bootloader 会按 `flag_last_success` 机制切回原厂分区。
- **正式装完后回原厂**：用小米官方 **MIWIFIRepairTool** 修复工具——电脑网线直连 AX3600 的 LAN 口，
  运行工具、选择原厂固件包，工具会通过 TFTP 把官方固件刷回去，恢复出厂状态（小米固件、米家管理都回来）。
  这是小米官方给的救砖通道，成功率很高，不需要动第 4 步的备份。
  工具官方直链（979,690 字节的 zip）：`https://cdn.cnbj1.fds.api.mi-img.com/xiaoqiang/tools/MIWIFIRepairTool.x86.zip`
  注意：小米路由器会劫持 `miwifi.com` 域名到本地后台，在家里网络打开小米官网下载页会跳到路由器管理页，
  属正常现象；上面的 CDN 直链不受劫持影响，可直接下载（或用手机流量打开官网）。
- **手动 TFTP 救砖**：修复工具不行时，OpenWrt 官方 wiki 有 AX3600 的 debrick 步骤，原理相同、手动操作。
- 第 4 步备份的 `mtd8-art.bin` 等文件是最后保险，留着别删。

## 12. 日常维护 & 常见问题

- **订阅自动更新**：OpenClash → 全局设置 → 计划任务，打开"配置文件自动更新"（每天凌晨一次）。
- **过滤器更新**：AdGuardHome → 过滤器 → 拦截列表，定期点"检查更新"。
- **装完 Clash 上不了网**：先去 OpenClash 里点"停止运行"，看是否恢复；
  九成是 DNS 环路——检查 NameServer 里有没有 127.0.0.1，有就删掉。
- **AdGuardHome 的 :3000 打不开**：SSH 里看 `logread | grep -i adguard` 找报错。
- **53 端口被占**：`ss -lntp | grep ':53 '` 看是谁在监听，应该只有 adguardhome。
- **部分 UDP 应用（如游戏语音）异常**：试试 OpenClash 里切换到 TUN 模式，或把这台设备网关改回 192.168.31.1 绕开。
