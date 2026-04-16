测试说明：按 **alice1 抵押、bob3000 借款** 给出一套绝对正确的基线数据（单场景）

对应流程：`test/test_qjh/positive/hf-check.integration.test.ts` 中 baseline borrow（借 60 BOB）

## 1) 账户与角色
- `alice1`：借款方（执行“抵押 + 借款”操作）
- `bob3000`：流动性提供方/清算准备账户
- 说明：`alice1` / `bob3000` 是本说明文档使用的业务名；测试代码内部使用 `A/B/C/D` 钱包代号。

## 2) 初始化参数（与测试代码一致）
- Alice 价格：`100`
- Bob 价格：`1`
- 借贷池 Bob 初始流动性：`5000`
- FlashLoanPool Bob 初始流动性：`1000`
- FlashLoanSwap 初始流动性：`100 ALC + 10000 BOB`
- FlashLoanSwap 汇率：`0.01`
- 价格计价前提：Alice/Bob 价格均以同一基准币计价
- 风险参数：
  - Alice：可抵押、不可借款，`ltv=0.75`，`liquidationThreshold=0.85`
  - Bob：不可抵押、可借款

## 3) 操作数据（唯一一套）
- `alice1` 存入并抵押：`2 ALC`
- `alice1` 借出：`60 BOB`
- `bob3000` 保持池子流动性（`5000 BOB`）供借款使用

## 4) 结果（确定值）
- 债务：`60.0000 BOB`
- 健康因子 HF：`2.8333`
  - 计算：`HF = (2 * 100 * 0.85) / 60 = 2.8333`
  - 其中：`2`=抵押 Alice 数量，`100`=Alice 价格，`0.85`=liquidationThreshold，`60`=借出的 Bob 数量
- `alice1` 全额还款后可取回：`2.0000 ALC`
