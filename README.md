# @yodagg/oss-upload-cli

一个功能强大的阿里云OSS文件上传命令行工具，支持单文件和批量文件上传，具备智能重试、并发控制、进度显示等特性。

## 功能特性

- ✅ 支持单文件和目录批量上传
- ✅ 智能并发控制，提升上传效率
- ✅ 自动重试机制，支持网络异常恢复
- ✅ 实时进度显示和上传状态反馈
- ✅ 文件类型和大小验证
- ✅ 大文件流式上传优化
- ✅ 详细的错误分类和处理建议

## 安装

### 全局安装（推荐）

```bash
npm install @yodagg/oss-upload-cli -g
```

### 项目内安装

```bash
npm install @yodagg/oss-upload-cli --save-dev
```

## 使用方法

### 基本用法

```bash
oss-upload-cli -s ./dist -t dist -key your_access_key -secret your_secret_key -b your_bucket -r oss-cn-hangzhou
```

### 上传单个文件

```bash
oss-upload-cli -s ./index.html -t web/ -key xxx -secret xxx -b xxx -r xxx
```

### 上传整个目录

```bash
oss-upload-cli -s ./build -t static/ -key xxx -secret xxx -b xxx -r xxx
```

## 参数说明

| 参数 | 长参数 | 必需 | 说明 | 示例 |
|------|--------|------|------|------|
| `-s` | `--source` | ✅ | 本地文件或目录路径 | `./dist` 或 `./index.html` |
| `-t` | `--target` | ✅ | OSS远程目录路径 | `static/` 或 `web/` |
| `-key` | `--accessKeyId` | ✅ | 阿里云AccessKey ID | `LTAI4G...` |
| `-secret` | `--accessKeySecret` | ✅ | 阿里云AccessKey Secret | `xxx...` |
| `-b` | `--bucket` | ✅ | OSS存储桶名称 | `my-website` |
| `-r` | `--region` | ✅ | OSS区域 | `oss-cn-hangzhou` |

## 配置说明

### 获取阿里云OSS配置

1. 登录[阿里云控制台](https://oss.console.aliyun.com/)
2. 创建或选择一个OSS存储桶
3. 获取以下信息：
   - **Region**: 存储桶所在区域（如：oss-cn-hangzhou）
   - **Bucket**: 存储桶名称
   - **AccessKey**: 在RAM控制台创建AccessKey

### 常用Region列表

| 区域 | Region ID |
|------|----------|
| 华东1（杭州） | oss-cn-hangzhou |
| 华东2（上海） | oss-cn-shanghai |
| 华北1（青岛） | oss-cn-qingdao |
| 华北2（北京） | oss-cn-beijing |
| 华南1（深圳） | oss-cn-shenzhen |

## 高级特性

### 文件验证

- 自动检测文件大小（默认最大500MB）
- 禁止上传可执行文件（.exe, .bat, .cmd等）
- 跳过空文件和无效文件

### 性能优化

- 智能并发控制（最大5个并发）
- 大文件（>50MB）使用流式上传
- 指数退避重试策略

### 错误处理

工具会自动识别并处理以下错误类型：

- **网络错误**: 自动重试，最多5次
- **权限错误**: 检查AccessKey配置
- **文件错误**: 跳过无效文件继续上传
- **服务器错误**: 延迟重试

## 故障排除

### 常见问题

**1. 权限验证失败**
```
错误: AccessDenied
解决: 检查AccessKey和Secret是否正确，确保有OSS写入权限
```

**2. Bucket不存在**
```
错误: NoSuchBucket
解决: 检查Bucket名称和Region是否匹配
```

**3. 网络连接超时**
```
错误: timeout
解决: 检查网络连接，工具会自动重试
```

**4. 文件过大**
```
错误: 文件大小超过限制
解决: 单个文件不能超过500MB
```

### 调试模式

设置环境变量启用详细错误信息：

```bash
NODE_ENV=development oss-upload-cli -s ./dist -t dist -key xxx -secret xxx -b xxx -r xxx
```

## 许可证

MIT License

## 贡献

欢迎提交Issue和Pull Request！

## 更新日志

### v1.0.0
- 初始版本发布
- 支持单文件和批量上传
- 智能重试和并发控制
- 完整的错误处理机制