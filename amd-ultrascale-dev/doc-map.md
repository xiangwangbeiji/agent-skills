# 文档路由表 — 什么问题查哪本手册

`<doc>` 即 pdfgrep 的文档参数。先 `toc` 看章节,再 `search` 定位,最后 `read` 精读。

## 器件与选型

| doc | 手册 | 查什么 |
|---|---|---|
| ds890 | UltraScale 架构总览 | 各型号资源规模对比、产品家族定位 |
| ds893 | Virtex UltraScale 数据手册 | **VU190 电气参数权威来源**:速度等级时序、电压、GT 线速率上限、功耗静态参数 |
| ug440 | XPE 功耗估算 | 功耗估算方法、热设计输入 |

## 硬件架构(写 RTL 例化原语时)

| doc | 手册 | 查什么 |
|---|---|---|
| ug574 | CLB | LUT/FF 结构、进位链、SRL、分布式 RAM、控制集(CE/SR)规则 |
| ug572 | 时钟 | 时钟树结构、BUFGCE/BUFGCTRL/BUFGCE_DIV、MMCM/PLL 属性与合法配置、时钟布线规则 |
| ug573 | 存储 | Block RAM/FIFO 原语与模式、级联、ECC、URAM 无(UltraScale+ 才有 URAM,VU190 无) |
| ug579 | DSP48E2 | DSP 结构、流水级、SIMD、预加器、推断友好写法 |
| ug571 | SelectIO | I/O 电平标准、IDELAYE3/ODELAYE3/ISERDESE3/OSERDESE3、组件模式与 native 模式 |
| ug570 | 配置 | 上电/配置模式、bitstream 选项、ICAP、回读 |
| ug580 | SysMon | 片上温度/电压监控 e3 原语 |
| ug575 | 封装引脚 | **VU190 各封装 bank 分布、引脚表、MIG/GT 引脚规划**;SLR 与 bank 对应关系 |
| ug583 | PCB 设计 | 电源去耦、SI、DDR 走线、GT 通道 PCB 规则 |
| ug576 | GTH 收发器 | GTH 通道/QUAD 结构、参考时钟、CDR、均衡、环回、复位序列 |
| ug578 | GTY 收发器 | GTY(VU190 有 GTY)同上,更高线速率 |

## 工具流程(写约束/Tcl/分析报告时)

| doc | 手册 | 查什么 |
|---|---|---|
| ug974 | UltraScale 库指南 | **所有原语的端口/属性/例化模板权威来源**(Verilog+VHDL) |
| ug901 | 综合 | 推断规则(RAM/DSP/FSM)、综合属性(如 ASYNC_REG, MAX_FANOUT, RAM_STYLE)、Synth 报错 |
| ug903 | 使用约束 | XDC 全部:create_clock、I/O 延迟、时序例外、CDC 约束、物理约束、优先级 |
| ug904 | 实现 | opt/place/route 各步骤选项、策略、增量编译、Place/Route 报错 |
| ug906 | 设计分析 | report_timing 解读、时序收敛分析方法、CDC 报告、拥塞分析 |
| ug908 | 编程调试 | ILA/VIO/JTAG、debug core 插入流程、Labtools 报错 |
| ug835 | Tcl 命令参考 | **每条 Vivado Tcl 命令的语法/选项权威来源**(2054 页,务必 search 后 read) |
| ug949 | 设计方法论 | **全流程最高准绳**:RTL 编码规范、约束方法论、时序收敛路线图、SSI(跨 SLR)方法论 |

## 常见查询示例

```bash
python scripts/pdfgrep.py search ug974 "BUFGCE_DIV"      # 原语例化模板
python scripts/pdfgrep.py search ug901 "RAM_STYLE"        # 综合属性合法值
python scripts/pdfgrep.py search ug903 "set_clock_groups" # 约束用法
python scripts/pdfgrep.py search ug835 "report_utilization" # Tcl 命令选项
python scripts/pdfgrep.py search ds893 "GTY"              # VU190 GTY 线速率上限
python scripts/pdfgrep.py search ug949 "SLR"              # 跨 SLR 设计方法
```
