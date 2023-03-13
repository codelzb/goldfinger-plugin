## 安装
```javascript
npm install goldfinger-plugin --save-dev
```

## 使用
> 为了方便观看 分别用两个例子介绍两个功能，实际项目中这两种功能的参数可以合并
> 可兼容webpack3-5   node V10 +
```javascript
//in your webpack.config.js
1.
module.exports={
    module:{
        plugins:[
             // 检测打包后的config.js文件中是否包含外网IP地址
             // 如果config中包含'location.'字段 则默认为开发者已进行判断会直接通过
            new GoldfingerPlugin({
              detect: true,  //boolean类型,为false则不检测 反之检测 默认为true,
              // 可以省略RegExp参数,因为它拥有默认值 也可支持自定义检测IP的正则表达式
              RegExp:/https?:\/\/\b(?!(10)|192\.168|172\.(2[0-9]|1[6-9]|3[0-2]))[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}/g,
            }),
        ]
    }
}
2. 
module.exports={
    module:{
        plugins:[
             // 上传远程服务器  上传过程会有百分比进度显示
            new GoldfingerPlugin({
              host: 'your remote host',
              username: 'your remote username',
              password: 'your remote password',
              remotePath: 'your remote path', // 如果remotePath为空则不上传
              bk: true, // 是否备份
            }),
        ]
    }
}
```