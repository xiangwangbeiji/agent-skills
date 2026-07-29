# XDC 约束与时序硬规则速查(UltraScale / VU190)

权威来源 UG903(约束)、UG906(分析)、UG949 Ch5-6(方法论)。
命令确切语法用 `pdfgrep.py search ug903 <命令名>` 核实。

## 约束文件组织(UG903 Ch2 / UG949)

- 约束顺序:先时钟定义 → 时钟交互(groups)→ I/O 延迟 → 时序例外 → 物理约束;
  XDC 按文件顺序解析,后写的覆盖先写的(优先级规则见 UG903 "XDC Precedence")。
- 时序约束与物理约束(引脚/pblock)分文件;每个文件用 `PROCESSING_ORDER` 明确早晚。
- 禁止在 XDC 里写对未创建时钟的引用;get_* 查询为空时 Vivado 只告警,交付前必须
  清零 `Vivado 12-xxx` 空查询类 Warning。

## 时钟定义(UG903 Ch3)

- 每个外部输入时钟 `create_clock`;MMCM/PLL/GT 的派生时钟由工具自动生成
  (`report_clocks` 核对),**不要手工重复 create_clock 覆盖自动派生时钟**。
- 自定义分频/相移逻辑输出用 `create_generated_clock` 指定 -source;
- 所有异步时钟域显式 `set_clock_groups -asynchronous`(先用 `report_clock_interaction`
  确认哪些交互真实存在,再声明,防止误伤同步域)。

## I/O 约束(UG903 Ch4 / UG571 / UG575)

- 每个 I/O 必须有 `PACKAGE_PIN` + `IOSTANDARD`(缺省会触发 DRC NSTD-1/UCIO-1,
  bitstream 生成失败)。
- 电平标准与 bank VCCO 必须一致,HP bank 仅 1.0-1.8V、HR bank 1.2-3.3V(UG571);
  引脚分配前用 `search ug575 <封装名>` 核对 bank 类型。
- 有时序要求的 I/O 写 `set_input_delay` / `set_output_delay`(相对板级时钟);
  纯静态/异步引脚(LED、按键)用 `set_false_path` 显式豁免,不留未约束路径。

## 时序例外(UG903 Ch5-6)

- 使用优先级:能用 `set_multicycle_path` 就不用 max_delay,能用
  `set_max_delay -datapath_only` 就不用 false_path。
- 多周期约束 setup 移 N 后,**必须**配套 `-hold N-1`(只写 setup 是最常见错误)。
- `set_false_path -from A -to B` 是单向的,双向交互要写两条或用 clock_groups。
- 例外的作用对象尽量精确到寄存器/时钟,禁止大面积通配(如 `-from [all_registers]`)。

## 时序收敛检查清单(UG906 / UG949 Ch6)

交付前依次执行并达标:

```tcl
report_clock_interaction          ;# 无 unsafe(红色)交互
check_timing                      ;# 无 no_clock / unconstrained_internal_endpoints
report_timing_summary             ;# WNS >= 0, WHS >= 0, TNS = 0
report_cdc                        ;# 无 Critical
report_methodology                ;# TIMING-* 类违例逐条处理或书面豁免
report_exceptions -ignored        ;# 无失效例外(约束没作用到对象)
```

- WNS 违例分析顺序:先看路径 requirement 是否合理(约束错?)→ 逻辑级数
  (>10 级考虑重定时/流水)→ 布线绕行(拥塞,查 report_design_analysis)。
- 保持/hold 违例不允许靠"应该没事"忽略,hold 违例会直接功能错误。

## 物理约束(UG903 Ch8 / UG949 SSI)

- VU190 跨 SLR 规划:大模块用 pblock 绑定到单一 SLR,SLR 间只过流水化总线;
  pblock 不要画到恰好贴 SLR 边界的时钟区列上。
- 引脚规划期(无 RTL)用 I/O Planning 工程验证 `report_io` / DRC,再冻结引脚给 PCB
  (配合 UG583)。
