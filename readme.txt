[同时登录两个github]
最佳解决方案：给当前仓库“绑定”独立密码
不需要删除旧凭据，也不需要复杂的 SSH 配置。我们只需要修改一下这个项目的“远程地址”，把账号密码（Token）直接写进地址里。
请按照以下步骤操作：
1. 生成新账号的通行证 (Token)
(如果你刚才已经生成并复制了 Token，可以跳过这一步)
登录 GitHub (weiqi-qili 账号)。
Settings -> Developer settings -> Personal access tokens -> Tokens (classic)。
Generate new token (classic) -> 勾选 repo 和 workflow -> Generate。
复制那一串 ghp_ 开头的字符。
2. 在项目里单独绑定这个 Token
回到你的 VSCode 或 PowerShell，确保你在 weiqi-qili 文件夹下，执行下面这条命令：
请把下面的 你的TOKEN 换成你刚才复制的那串字符：
code
Powershell
git remote set-url origin https://weiqi-qili:你的TOKEN@github.com/weiqi-qili/weiqi-qili.github.io.git
(注意：这条命令执行完不会有任何提示，那是正常的)
3. 再次推送
现在，Git 会直接用你刚才绑定的 Token 去验证，而不会去问 Windows 要旧密码了。
code
Powershell
git push -u origin main
这次应该就能成功了！

------
每次你在本地写完代码，只需要：
npm run dev (本地看效果)
git add .
git commit -m "更新说明"
git push

我已经正常提交到github，并且构建成功，
可以打开qili.iloveweiqi.com了。
这是数据库信息
https://ovfvidgthyezdpijgbgl.supabase.co
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im92ZnZpZGd0aHllemRwaWpnYmdsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY0NjE2NDgsImV4cCI6MjA4MjAzNzY0OH0.j1wgus8CaL1i8NOXgrYMMPiFVcPen1rWhUaBRvz0o9Y
我忘记最终的目录结构和代码了，
帮我生成全部最新的代码，先测试一下。
---
因为国内访问supabase也受限，
所以也要通过cloudflare去访问
supabase-qili.iloveweiqi.com
帮我
----
挺好的：
1、棋盘尽量大一些
2、做错后，提示正解。