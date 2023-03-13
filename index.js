const { NodeSSH } = require("node-ssh")
const fs = require("fs")
const { join } = require("path")
const chalk = require("chalk")
const webpack = require("webpack/package.json")
const readline = require("readline-sync")
const slog = require("single-line-log").stdout

let pb = null
class ProgressBar {
  constructor(description, bar_length) {
    // 两个基本参数(属性)
    this.description = description || "Progress" // 命令行开头的文字信息
    this.length = bar_length || 25 // 进度条的长度(单位：字符)，默认设为 25
  }
  // 刷新进度条图案、文字的方法
  render(opts) {
    if (opts.total <= 0) return
    const percent = (opts.completed / opts.total).toFixed(4) // 计算进度(子任务的 完成数 除以 总数)
    const cell_num = Math.floor(percent * this.length) // 计算需要多少个 █ 符号来拼凑图案

    // 拼接黑色条
    let cell = ""
    for (let i = 0; i < cell_num; i++) cell += "█"

    // 拼接灰色条
    let empty = ""
    for (let i = 0; i < this.length - cell_num; i++) empty += "░"

    // 拼接最终文本
    const cmdText = `${this.description}: ${(100 * percent).toFixed(2)}% ${cell}${empty} ${opts.completed}/${opts.total} ${opts.fileName ? `uploading : ${opts.fileName}` : ""} ${opts.fileDir ? "complete: " + opts.fileDir : ""}`
    // 在单行输出文本
    slog(cmdText)
  }
}
class Goldfinger {
  constructor(options) {
    this.ssh = new NodeSSH()
    this.fileCount = 0
    this.options = options || {
      host: "",
      username: "",
      password: "",
      remotePath: "",
    }
  }
  apply(compiler) {
    const version = webpack.version
    if (version[0] == "3") {
      compiler.plugin("done", async (compilation) => {
        await this.handler(compiler.options.output.path)
      })
    } else if (compiler.hooks) {
      compiler.hooks.done.tap("Goldfinger", async (stats) => {
        await this.handler(stats.compilation.outputOptions.path)
      })
    }
  }
  async handler(outputPath) {
    fs.readFile(outputPath + "/config/config.js", "utf-8", (err, data) => {
      if (err) console.log(chalk.red("读取文件错误,无法检验config文件内IP"))
      let isLocation = data.indexOf('location.') !== -1
      data = data
        .replace(/(window.config)/g, "var config")
        .replace(/\$\{.*window\..*\}/g, "")
        .replace(/(window\.\w*\.\w*)(\)*)/g, (match, p1, p2) => {
          if (p2 === ")") {
            return ")"
          } else {
            return "undefined"
          }
        })
        .replace(/config\s*=/g, "config = global.config =")
        .replace(/window/g, "global")
      eval(`
                try{
                  if(isLocation) {
                    this.handlerRemote(outputPath)
                  }else{
                    ${data}
                    let isInternet = this.findUrls(global.config)
                    if(isInternet.length&&this.options.detect !== false){
                        console.log(chalk.red('警告:打包后的config.js中含有外网IP地址'))
                        readline.question("Enter any key to continue:");
                        this.handlerRemote(outputPath)
                    }else{
                        this.handlerRemote(outputPath)
                    }
                  }
                }catch(err) {
                    console.log(chalk.red('警告:格式错误 无法检测config', err))
                }
            `)
    })
  }
  async handlerRemote(outputPath) {
    if (this.options.remotePath) {
      let time = this.getNowFormatDate()
      await this.connectServer()
      const serverDir = this.options.remotePath
      let result = await this.ssh.execCommand(`find ${serverDir} -maxdepth 1 -printf "%f\n"`)
      let fileNameList = result.stdout.split("\n").slice(1)
      if (!fileNameList.length || this.options.power === "root" || (fileNameList.includes("css") && fileNameList.includes("fonts") && fileNameList.includes("config") && fileNameList.includes("resources") && fileNameList.includes("worker") && fileNameList.includes("index.html"))) {
        if (fileNameList.length) {
          if (this.options.bk !== false) {
            await this.ssh.execCommand(`mkdir -p ${serverDir}/_bk/${time}`)
            await this.ssh.execCommand(`rsync -av --exclude='_bk' ${serverDir}/* ${serverDir}/_bk/${time}/`)
          }
          await this.ssh.execCommand(`rm -rf ${serverDir}/* !(_bk)`)
        }
        pb = new ProgressBar("正在上传...", 0)
        this.compute(outputPath)
        await this.uploadFiles(outputPath, serverDir)
        this.ssh.dispose()
      } else {
        console.log(chalk.red("上传失败, 设置的上传目录并非空目录或者目录内没有匹配到前端部署痕迹！"))
      }
    }
  }
  async connectServer() {
    await this.ssh.connect({
      host: this.options.host,
      username: this.options.username,
      password: this.options.password,
    })
  }
  async uploadFiles(localPath, remotePath) {
    const successful = []
    let length = 0
    const status = await this.ssh.putDirectory(localPath, remotePath, {
      recursive: true,
      concurrency: 10,
      tick: function (localPath, remotePath, error) {
        if (!error) {
          length = length + 1
          pb.render({ completed: length, total: this.fileCount, fileName: localPath })
          successful.push(localPath)
        }
      }.bind(this),
    })
    if (status) {
      console.log(chalk.green("\n传输服务器成功!"))
    } else {
      console.log(chalk.red("\n传输至服务器失败!"))
    }
  }
  getNowFormatDate() {
    var date = new Date()
    var seperator1 = ""
    var seperator2 = ""
    var month = date.getMonth() + 1
    var strDate = date.getDate()
    var strHours = date.getHours()
    var strMin = date.getMinutes()
    var strSec = date.getSeconds()
    if (month >= 1 && month <= 9) {
      month = "0" + month
    }
    if (strDate >= 0 && strDate <= 9) {
      strDate = "0" + strDate
    }
    if (strHours >= 0 && strHours <= 9) {
      strHours = "0" + strHours
    }
    if (strMin >= 0 && strMin <= 9) {
      strMin = "0" + strMin
    }
    if (strSec >= 0 && strSec <= 9) {
      strSec = "0" + strSec
    }
    var currentdate = date.getFullYear() + seperator1 + month + seperator1 + strDate + "" + strHours + seperator2 + strMin + seperator2 + strSec
    return currentdate
  }
  findUrls(obj) {
    let urls = []

    for (let key in obj) {
      let value = obj[key]

      if (typeof value === "string") {
        let regex = this.options.RegExp || /https?:\/\/\b(?!(10)|192\.168|172\.(2[0-9]|1[6-9]|3[0-2]))[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}/g
        if (regex.test(value)) {
          urls.push(value)
        }
      } else if (typeof value === "object") {
        let subUrls = this.findUrls(value)
        urls = urls.concat(subUrls)
      }
    }

    return urls
  }
  compute(path) {
    try {
      //判断当前文件的存在 如果文件夹不存在就直接返回
      if (!fs.existsSync(path)) {
        return
      }
      //读取当前文件夹的内容
      let files = fs.readdirSync(path) //获取当前文件下的数组
      //然后遍历这个 数组
      files.forEach((file) => {
        //判断当前file是否为文件夹 得到stats对象
        let stats = fs.statSync(join(path, file))
        //判断单签路径是否是文件夹
        if (stats.isDirectory()) {
          // 然后递归
          this.compute(join(path, file))
        } else {
          this.fileCount = this.fileCount + 1
        }
      })
    } catch (error) {
      console.log("error", error)
    }
  }
}

module.exports = Goldfinger
