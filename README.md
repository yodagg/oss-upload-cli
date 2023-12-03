## @yodagg/oss-upload-cli

通过命令行上传文件到阿里云oss

### 安装

```bash
npm install @yodagg/oss-upload-cli -g
```

### 使用

```bash
oss-upload-cli -s ./dist -t dist -key xxx -secret xxx -b xxx -r xxx
```

参数说明：
```
.option('-s, --source <value>', '本地文件｜目录')
.option('-t, --target <value>', '远程目录')
.option('-key, --accessKeyId <value>', 'oss accessKeyId')
.option('-secret, --accessKeySecret <value>', 'oss accessKeySecret')
.option('-b, --bucket <value>', 'oss bucket')
.option('-r, --region <value>', 'oss region')
```