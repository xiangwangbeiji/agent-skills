# Vivado Tcl / 流程硬规则速查(2026.x)

命令确切选项一律 `pdfgrep.py search ug835 <命令名>` 后 read 核实(2054 页,别猜)。
流程步骤与策略见 UG904,方法论见 UG949。

## 脚本化流程(UG835 / UG904)

- 可复现构建用**非工程模式**(non-project batch):`read_verilog / read_xdc →
  synth_design → opt_design → place_design → phys_opt_design → route_design →
  write_checkpoint / report_*`;工程模式(project mode)只用于交互调试。
- 每个实现步骤后立即写 checkpoint 和时序摘要:
  ```tcl
  write_checkpoint -force $step.dcp
  report_timing_summary -file $step_timing.rpt
  ```
- 脚本中所有 report_* 都加 `-file` 落盘;失败排查靠报告文件,不靠回忆 GUI。
- `get_*` 查询结果先存变量并判空再用,空集合直接传给 set_property 会静默不生效。

## 综合(UG901)

- 综合属性写在 RTL(`(* attribute *)`)优先于 XDC 写 property:属性跟代码走,
  不易失配;XDC 侧属性仅用于不便改源码的第三方 IP。
- 层次保留策略:默认 `-flatten_hierarchy rebuilt`;调试期可用 `keep_hierarchy`
  定点保层次,量产综合不要全局禁扁平化(损失跨界优化)。
- OOC(out-of-context)综合大 IP/稳定模块,缩短迭代;OOC 模块内部时钟要在
  OOC XDC 里补 create_clock。
- 综合后立即检查:`report_utilization`(资源超限早发现)、Synth 告警中的
  推断失败(RAM/DSP 没进硬核)与锁存器。

## 实现(UG904 / UG949)

- 默认策略跑通 → 时序不收敛再换策略(Explore 系),**不要一上来就堆策略**;
  先按 UG949 Ch6 排查约束和 RTL 问题。
- VU190(SSI)布局关注 `report_design_analysis -congestion` 和跨 SLR net 数;
  拥塞等级 ≥5 时先降扇出/减控制集,再考虑 pblock。
- phys_opt_design 只在 place 后 WNS < 0 时有意义,可多次迭代;route 后仍违例
  用 `phys_opt_design`(post-route 模式)做最后挽救。
- 增量实现(incremental)用于小改动迭代:`read_checkpoint -incremental ref.dcp`,
  改动 >30% 时放弃增量重跑全流程。

## 报告与签核(UG906)

- 每次交付跑齐:timing_summary / methodology / cdc / drc / utilization / power;
  见 [constraints.md](constraints.md) 检查清单。
- `report_qor_suggestions` 可生成改进建议,采纳前逐条理解,不盲目套用。

## 调试(UG908)

- ILA 插入优先 RTL 例化或 `set_property MARK_DEBUG true`(netlist 插入易被优化掉);
  MARK_DEBUG 的 net 会禁止优化,调试结束必须移除,否则伤时序。
- ILA 时钟必须是被观测逻辑的同域自由运行时钟;深度受 BRAM 预算约束。
- bitstream 选项(压缩、配置速率等)通过 `set_property BITSTREAM.*`,合法值查
  UG908 附录 + UG570。
