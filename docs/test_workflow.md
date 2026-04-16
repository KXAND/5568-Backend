测试说明：按 **alice1 抵押、bob3000 借款** 给出一套绝对正确的基线数据（单场景）

对应流程：`test/test_qjh/positive/hf-check.integration.test.ts` 中 baseline borrow（借 60 BOB）

## 1) 账户与角色
- `alice1`：借款人（对应测试钱包 `B`）
- `bob3000`：流动性提供方/清算准备账户（对应测试钱包 `A`）

## 2) 初始化参数（与测试代码一致）
- Alice 价格：`100`
- Bob 价格：`1`
- 借贷池 Bob 初始流动性：`5000`
- FlashLoanPool Bob 初始流动性：`1000`
- FlashLoanSwap 初始流动性：`100 ALC + 10000 BOB`
- FlashLoanSwap 汇率：`0.01`
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
- `alice1` 全额还款后可取回：`2.0000 ALC`
