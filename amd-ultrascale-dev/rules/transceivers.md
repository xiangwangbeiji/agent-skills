# GTH/GTY 收发器硬规则速查(UltraScale / VU190)

权威来源:UG576(GTH)、UG578(GTY)、DS893(线速率/电气)、UG583(PCB)。
VU190 满配(FLGA2577):**60×GTH(≤16.3 Gb/s)+ 60×GTY(≤30.5 Gb/s)**
(DS890 p13-14 实测);实际可用数量随封装变化,先 `search ug575 <封装>` 核对。

## 总则

- **一律通过 Transceiver Wizard(gtwizard_ultrascale)生成收发器**,不手写 GTHE3/GTYE3
  原语例化——通道属性数以百计且与线速率强相关,手写必错。
- 修改 wizard 生成代码前,先 `search ug576/ug578 <属性名>` 理解属性含义;改动记录进
  设计文档,IP 升级时逐条重放。
- VU190 是 UltraScale:原语后缀 **E3**(GTHE3_CHANNEL、IBUFDS_GTE3),
  不要照抄 UltraScale+ 的 E4 代码。

## 参考时钟(UG576/UG578 "Reference Clock")

- 参考时钟必须从 GT 专用 MGTREFCLK 引脚经 `IBUFDS_GTE3` 进入,禁止用普通 I/O
  或 fabric 时钟做参考时钟。
- 一个参考时钟可驱动本 QUAD 及相邻上下各一个 QUAD(北/南路由);跨度超过 ±1 QUAD
  必须换引脚规划,布局前用 wizard 校验。
- 参考时钟频率、抖动指标按 DS893 对应线速率行选取;PCB 侧 AC 耦合与端接按 UG583。

## 时钟输出与用户逻辑

- 用户侧时钟(TXUSRCLK/RXUSRCLK)按 wizard 推荐的 BUFG_GT 方案,不自行改接
  普通 BUFG;TXOUTCLK 驱动多通道共享 fabric 逻辑时注意通道间相位不保证。
- 多通道绑定(channel bonding)/多 lane 对齐必须在 wizard 里配置,不在 fabric 拼。

## 复位与初始化(UG576/UG578 "Reset")

- 严格使用 wizard 生成的复位状态机(*_reset 控制器);TX/RX 复位序列有先后依赖,
  禁止自写一根线复位所有模块。
- 上电后必须等 GTPOWERGOOD;更换线速率/参考时钟后走完整 reset sequence。
- 链路不通排查顺序:GTPOWERGOOD → refclk 频率实测(ILA 计数)→ resetdone →
  环回测试(near-end PCS → near-end PMA → 远端)→ 眼图/均衡。环回模式代码
  查 `search ug576 "loopback"`。

## 均衡与信号完整性

- RX 均衡模式(DFE/LPM)按插损选择:短链路/低损耗 LPM,长链路/高损耗 DFE
  (阈值与建议见 UG576/UG578 RX Equalizer 章节)。
- TX 预加重/摆幅(TXDIFFCTRL/TXPRE/TXPOST)从 wizard 默认起步,配合误码仪或
  IBERT(UG908)扫描定参,不凭感觉设置。
- PCB layout 规则(过孔残桩、AC 耦合电容位置、差分对内偏差)以 UG583 GT 章节为准。

## 常见报错路由

| 现象/报错 | 查 |
|---|---|
| wizard DRC 报参考时钟位置非法 | UG576/UG578 参考时钟章节 + ug575 引脚表 |
| resetdone 不拉高 | UG576/UG578 Reset 章节(检查依赖顺序、GTPOWERGOOD) |
| 链路误码高 | RX 均衡章节 + UG583 SI + IBERT 扫描(UG908) |
| CPLL/QPLL 锁不住 | 对应 PLL 章节:refclk 频率合法范围、分频配置 |
