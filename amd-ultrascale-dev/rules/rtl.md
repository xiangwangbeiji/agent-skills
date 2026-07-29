# RTL 硬规则速查(UltraScale / VU190)

出处标注到手册章节;需精确页码/原文时用 `pdfgrep.py search <doc> <关键词>` 核实。
原语端口和例化模板一律以 UG974 为准,不得凭记忆写。

## 时钟(UG572 / UG949)

- 时钟必须经全局时钟缓冲(BUFGCE / BUFGCTRL / BUFGCE_DIV),禁止用 LUT 逻辑生成或门控时钟;
  需要门控效果时用 BUFGCE 的 CE 端。
- 分频时钟优先 BUFGCE_DIV(输出相位天然对齐,依据 UG572 p29-30),其次 MMCM 多路输出;
  禁止 RTL 计数器分频后当时钟用(应产生 CE 使能脉冲代替)。
- 频率合成用 MMCME3/PLLE3;MMCM 的 VCO/分频合法范围与速度等级相关,配置前用
  `search ug572 "MMCM"` + DS893 核实,不要照搬 7 系列参数。
- 一个时钟域一个主 BUFG;避免同一逻辑混用同源不同 BUFG 的时钟(引入不必要的偏斜分析)。

## 复位(UG949 "Resets")

- 能不复位就不复位:数据通路寄存器、SRL、流水线不接复位;只复位控制状态。
- 优先**同步复位、高有效**(与器件原语原生极性一致,避免额外反相 LUT)。
- 异步复位若必须使用:释放必须同步(reset synchronizer),同步器两级 FF 加
  `ASYNC_REG = "TRUE"`。
- 复位不要接到 BRAM 输出寄存器以外的存储原语(SRL/分布式 RAM 无复位端)。

## CDC(UG949 "Clock Domain Crossing" / UG903 Ch6)

- 单 bit:两级 FF 同步器,两级都标 `ASYNC_REG = "TRUE"`(该属性同时禁止综合优化和布局拉远)。
- 多 bit:异步 FIFO(XPM_FIFO_ASYNC)、握手,或格雷码计数器;禁止多 bit 直接打两拍。
- 约束用 `set_max_delay -datapath_only` 优于 `set_false_path`(保留最大延迟约束);
  交付前必须跑 `report_cdc` 清零 Critical。

## 存储(UG573 / UG901)

- 优先**推断**(标准双端口模板见 UG901 "RAM HDL Coding Techniques"),用 `RAM_STYLE`
  属性(block/distributed/registers)控制映射;推断失败再例化 XPM_MEMORY,最后才是原语。
- BRAM 打开输出寄存器(推断时多写一级输出 FF)可显著提频;不开输出寄存器的 BRAM
  是常见时序瓶颈。
- 注意:VU190 是 UltraScale(非 +),**没有 URAM**;深度大的存储用 BRAM 级联(UG573)。
- BRAM 写模式冲突(同地址读写)行为按 WRITE_MODE 而定,跨端口同地址无保护,需查 UG573。

## DSP(UG579 / UG901)

- 乘法器写成**有符号**(signed)并保证足够流水级(输入寄存器 + M 寄存器 + P 寄存器,
  全速运行需 3 级),让综合映射进 DSP48E2。
- 用 `USE_DSP` 属性控制加法器/计数器是否进 DSP;预加器(pre-adder)结构见 UG579。
- 位宽超过 27x18(有符号)会级联多个 DSP,注意流水线随之加深。

## 控制集与高扇出(UG949 / UG574)

- 减少控制集数量:CE/SR 信号低扇入的不如去掉(用数据路径 mux 代替),同一模块内
  统一复位/使能极性;UltraScale 每 half-CLB 共享控制集(UG574)。
- 高扇出网络:优先寄存器复制(`MAX_FANOUT` 属性或手工 `KEEP` + 复制),不要指望
  工具自动修复十万级扇出。

## SSI / 跨 SLR(UG949 "SSI Components"/"SLR")

- VU190 为 3-SLR SSI 器件:跨 SLR 的数据路径**两端都加流水寄存器**(至少各一级);
  高带宽总线跨 SLR 提前做 pblock 规划。
- 时钟尽量在时钟源所在 SLR 内消费;跨 SLR 时钟树由工具处理,但源同步接口勿跨 SLR。

## 通用编码(UG901 / UG949)

- 同步设计,单时钟沿;禁止组合环路、锁存器(综合后检查 `report_methodology` 的
  LATCH/LOOP 告警)。
- FSM 用枚举/localparam 编码,默认分支必须写全;综合器 FSM 提取见 UG901 "FSM"。
- 模块端口打寄存器(输入/输出至少一级),便于时序收敛和 OOC 综合。
- 例化原语前必须 `search ug974 <原语名>` 获取权威端口表,禁止凭记忆。
