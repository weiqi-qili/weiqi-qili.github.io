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