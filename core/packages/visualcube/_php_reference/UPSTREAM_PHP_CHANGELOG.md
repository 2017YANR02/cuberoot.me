# visualcube的修改日志

## 1.适配个人服务器
- 修改visualcube.php 为 index.php
- 静态文件目录加了了前缀visualcube

## 2.修改了view为trans时候，白色底面显示的bug
[点我查看效果](http://solarsunrise.cn/index.php?fmt=svg&bg=t&view=trans&sch=ygrwbo&r=y30x-30&stage=cross&size=500)  
![](http://solarsunrise.cn/index.php?fmt=svg&bg=t&view=trans&sch=ygrwbo&r=y30x-30&stage=cross&size=500)

## 3.fc、sch、fd可以使用数字代表参数重复,方便快速涂色
`&fc=y10o20b30` [点我查看效果](http://solarsunrise.cn/index.php?fmt=svg&size=500&pzl=7&fc=y10o20b30)  
![](http://solarsunrise.cn/index.php?fmt=svg&size=500&pzl=7&fc=y10o20b30)

`&sch=y2o2b2` [点我查看效果](http://solarsunrise.cn/index.php?fmt=svg&size=500&pzl=7&sch=y2o2b2&view=plan)  

![](http://solarsunrise.cn/index.php?fmt=svg&size=500&pzl=7&sch=y2o2b2&view=plan)

## 4.alg 和 case支持 括号表示重复
`alg=(RUR'U')5` [点我查看效果](http://solarsunrise.cn/index.php?fmt=svg&size=500&pzl=3&alg=(R%20UR%27U%27)5)  
![](http://solarsunrise.cn/index.php?fmt=svg&size=500&pzl=3&alg=(R%20UR%27U%27)5)

## 5. alg 和 case 对高阶魔方的支持 中间单层 如 4R 4U
`&alg=4R 5U` [点我查看效果](http://solarsunrise.cn/index.php?fmt=svg&size=500&pzl=7&alg=%204R%205U)  
![](http://solarsunrise.cn/index.php?fmt=svg&size=500&pzl=7&alg=%204R%205U)


## 6. alg 和 case 对高阶魔方的支持 中间多层 如 3-4r 2-5u' 2-4f2
`&alg=3-4r 2-5u'` [点我查看效果](http://solarsunrise.cn/index.php?fmt=svg&size=500&pzl=7&alg&alg=alg=3-4r%202-5u%27)  
![](http://solarsunrise.cn/index.php?fmt=svg&size=500&pzl=7&alg&alg=alg=3-4r%202-5u%27)

`&alg=2-4f2` [点我查看效果](http://solarsunrise.cn/index.php?fmt=svg&size=500&pzl=7&alg&alg=2-4f2)  
![](http://solarsunrise.cn/index.php?fmt=svg&size=500&pzl=7&alg&alg=2-4f2)

## 7. alg 和 case 对高阶魔方的支持 内层转动 m e s
`&alg=m e s` [点我查看效果](http://imagebed.solarsunrise.cn/blog/img/20200317160754.png)  
![](http://imagebed.solarsunrise.cn/blog/img/20200317160754.png)

`&alg=m2 e2 s2` [点我查看效果](http://imagebed.solarsunrise.cn/blog/img/20200317161653.png)  
![](http://imagebed.solarsunrise.cn/blog/img/20200317161653.png)