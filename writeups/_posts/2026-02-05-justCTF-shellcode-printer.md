---
layout: post
title: "justCTF - Shellcode printer"
date: 2026-02-05
tags: [pwn, format string]
---

For my first real writeup on here, i've decided to document a pretty simple pwn challenge I solved a while ago at [justCTF2025](https://2025.justctf.team/). 

TL;DR: The challenge contains a simple format string vulnerability, which we can abuse to write arbitrary shellcode into a memory page in 2-byte chunks, which the binary then executes.

![shellcode printer]({{ site.baseurl }}/assets/images/shellcode_printer_description.jpg)

The challenge provides provides us with just the binary and a Dockerfile. First, let's do some basic reconnaissance using `file` and `checksec`:

```bash
(pyvenv) urichh@toaster:~/Desktop/challs-dropbox/justCTF2025-pwn-shellcode_printer$ file vuln
vuln: ELF 64-bit LSB pie executable, x86-64, version 1 (SYSV), dynamically linked, interpreter /lib64/ld-linux-x86-64.so.2, BuildID[sha1]=e454d2e08d672dd2e65a794a8fa7bb2bbb673aed, for GNU/Linux 3.2.0, stripped
```

```bash
(pyvenv) urichh@toaster:~/Desktop/challs-dropbox/justCTF2025-pwn-shellcode_printer$ checksec vuln
[*] '/home/urichh/Desktop/challs-dropbox/justCTF2025-pwn-shellcode_printer/vuln'
    Arch:       amd64-64-little
    RELRO:      Full RELRO
    Stack:      Canary found
    NX:         NX enabled
    PIE:        PIE enabled
    SHSTK:      Enabled
    IBT:        Enabled
```