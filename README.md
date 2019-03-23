gitlab-import-export (cli)
---

```
$ gitlab-ie [options]
Options:
  --version      Show version number                                   [boolean]
  --domain, -d                                  [string] [default: "gitlab.com"]
  --token, -t                                                [string] [required]
  --storage, -s                                          [string] [default: "."]
  --import, -i                                        [boolean] [default: false]
  --help         Show help                                             [boolean]
```



### export backup

```
gitlab-ie -d gitlab.example.com -t token -s ~/backups/gitlab/
```



### import backup

```
gitlab-ie -d gitlab.example.com -t token -s ~/backups/gitlab/ -i
```

