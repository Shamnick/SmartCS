# 智能客服与文档检索系统

基于 Spring AI + LangChain4j + DeepSeek + Milvus 的企业智能客服系统，通过 RAG（检索增强生成）技术实现企业知识的自动化、精准化问答。

<img width="3200" height="1756" alt="image" src="https://github.com/user-attachments/assets/321b083b-7e1d-4d13-b579-f7213a34bbdd" />

## 系统架构

```
┌─────────────────────────────────────────────────────────┐
│                    前端 Chat UI                          │
├─────────────────────────────────────────────────────────┤
│                  REST API Layer                          │
│         ChatController  KnowledgeController              │
├──────────┬──────────────┬───────────────────────────────┤
│          │              │                               │
│  ChatService    KnowledgeService    MonitorController    │
│          │              │                               │
├──────────┼──────────────┼───────────────────────────────┤
│          │              │                               │
│  Context │   RAG Layer  │    Function Calling           │
│  Manager │  ┌──────────┐│   ┌─────────────────┐        │
│          │  │DocParser ││   │ FunctionRegistry │        │
│          │  │Embedding ││   │ OrderQuery       │        │
│          │  │Retrieval ││   │ ProductQuery     │        │
│          │  └──────────┘│   │ KnowledgeSearch  │        │
├──────────┴──────────────┴───┴─────────────────┴────────┤
│                                                         │
│   DeepSeek LLM (via LangChain4j)    Milvus Vector DB   │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

## 技术栈

| 技术 | 说明 |
|------|------|
| Spring Boot 3.3 | 基础框架 |
| Spring AI | AI能力集成框架 |
| LangChain4j | LLM编排框架，接入DeepSeek |
| DeepSeek | 大语言模型 |
| Milvus | 向量数据库，存储文档Embedding |
| Caffeine + Redis | 多级缓存 |
| Spring AOP | 性能监控 |

## 核心功能

### 1. 自然语言问答
- 通过LangChain4j接入DeepSeek大模型
- 支持多轮对话上下文管理
- 滑动窗口策略防止Token超限

### 2. RAG检索增强生成
- 文档解析：支持 PDF、Word、TXT、Markdown
- 文档分片：递归分片策略，可配置chunk大小和重叠
- Embedding向量化：通过DeepSeek/OpenAI Embedding API
- 向量存储：Milvus向量数据库
- 相似度检索：基于余弦相似度的语义搜索

### 3. Function Calling
- 注册式函数管理（FunctionRegistry）
- 大模型自动识别函数调用意图
- 内置业务函数：订单查询、产品查询、知识搜索
- 函数结果自动整合回答

### 4. Prompt工程
- 结构化System Prompt
- RAG上下文注入
- Function Calling指令嵌入
- 上下文窗口管理

### 5. 性能优化
- **并发控制**：Semaphore限流 + 线程池隔离
- **多级缓存**：Caffeine本地缓存 + Redis分布式缓存
- **异步处理**：文档上传、Embedding异步化
- **批量处理**：大文档分批向量化
- **AOP监控**：方法级性能指标采集

## 快速开始

### 前置条件
- JDK 17+
- Maven 3.8+
- Milvus 2.x（可用Docker部署）
- Redis（可选，缓存用）
- DeepSeek API Key

### 1. 启动 Milvus
```bash
# Docker方式
docker run -d --name milvus \
  -p 19530:19530 -p 9091:9091 \
  milvusdb/milvus:v2.4.0 milvus run standalone
```

### 2. 配置 API Key
```bash
# 环境变量方式
export DEEPSEEK_API_KEY=sk-your-api-key

# 或修改 application.yml
deepseek:
  api-key: sk-your-api-key
```

### 3. 构建 & 运行
```bash
mvn clean package -DskipTests
java -jar target/smart-customer-service-1.0.0.jar
```

### 4. 访问
- 前端界面：http://localhost:8080
- API文档：见下方API接口

## API 接口

### 聊天接口
```
POST /api/chat
{
  "message": "你好，请问退换货政策是什么？",
  "sessionId": "可选",
  "enableRag": true,
  "enableFunctionCalling": true
}
```

### 知识库管理
```
POST /api/knowledge/upload          # 上传文档文件
POST /api/knowledge/text            # 上传文本知识
GET  /api/knowledge/documents       # 文档列表
GET  /api/knowledge/statistics      # 知识库统计
DELETE /api/knowledge/documents/{id} # 删除文档
```

### 监控接口
```
GET  /api/monitor/overview          # 系统总览
GET  /api/monitor/metrics           # 性能指标
POST /api/monitor/metrics/reset     # 重置统计
GET  /api/chat/status               # 聊天服务状态
```

## 项目结构

```
src/main/java/com/smartcs/
├── SmartCustomerServiceApplication.java   # 启动类
├── config/
│   ├── DeepSeekConfig.java                # DeepSeek模型配置
│   ├── MilvusConfig.java                  # Milvus向量数据库配置
│   ├── CacheConfig.java                   # 缓存配置
│   ├── ThreadPoolConfig.java              # 线程池配置
│   ├── RateLimiterConfig.java             # 限流配置
│   └── WebConfig.java                     # Web配置
├── controller/
│   ├── ChatController.java                # 聊天API
│   ├── KnowledgeController.java           # 知识库管理API
│   └── MonitorController.java             # 监控API
├── service/
│   ├── ChatService.java                   # 核心聊天服务
│   ├── KnowledgeService.java              # 知识库服务
│   ├── context/
│   │   └── ConversationContextManager.java # 上下文管理
│   ├── rag/
│   │   ├── DocumentProcessor.java         # 文档处理
│   │   ├── EmbeddingService.java          # 向量化服务
│   │   └── RagRetrievalService.java       # RAG检索服务
│   └── function/
│       ├── BusinessFunction.java          # 业务函数接口
│       ├── FunctionRegistry.java          # 函数注册中心
│       ├── FunctionCallingService.java    # 函数调用服务
│       └── impl/
│           ├── OrderQueryFunction.java    # 订单查询
│           ├── ProductQueryFunction.java  # 产品查询
│           └── KnowledgeSearchFunction.java # 知识搜索
├── model/
│   ├── common/
│   │   └── R.java                         # 统一响应
│   ├── dto/
│   │   ├── ChatRequest.java               # 聊天请求
│   │   ├── ChatResponse.java              # 聊天响应
│   │   └── DocumentUploadRequest.java     # 文档上传请求
│   └── entity/
│       └── KnowledgeDocument.java         # 知识文档实体
├── exception/
│   └── GlobalExceptionHandler.java        # 全局异常处理
└── monitor/
    └── PerformanceMonitor.java            # 性能监控
```

## 扩展指南

### 新增 Function Calling 函数
1. 实现 `BusinessFunction` 接口
2. 通过 `@PostConstruct` 注册到 `FunctionRegistry`
3. 大模型会自动感知新函数

### 接入其他大模型
修改 `DeepSeekConfig` 中的 `baseUrl` 和 `model`，兼容所有 OpenAI API 格式的模型。

### 自定义 Prompt
修改 `ConversationContextManager` 中的 `SYSTEM_PROMPT` 常量。
