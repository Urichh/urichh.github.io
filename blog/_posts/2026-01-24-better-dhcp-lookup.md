---
title: "The pain of dealing with Microsofts DHCP Management Console, and some useful powershell for my own sanity"
date: 2026-01-24
categories:
tags:
layout: single
author_profile: true
---

If you've ever had the misfortune of having to use Microsofts DHCP Management Console snap-in (MMC), you probbably know that it leaves a lot to be desired. Released all the way back in the Windows 2000 server days, it's seen seemingly little improvement over the years.

I've only started using the DHCP management console relatively recently, and it never ceases to amaze me with the lack of features. Want to:
 - search through leases?
 - query multiple DHCP servers at once?
 - not have to re-add all servers every time you restart the console?
 - have the scopes show up in order, and not randomly every time you refresh?
 - add reservations without expanding the "reservations" field every time? (which closes after replicating scope)
 - etc.

Well then good luck, because the Console supports none of that. And these are only the examples from the top of my head.

In response to all the pain and suffering this has caused me, I decided to create a simple powershell script to interract with DHCP servers. This script has gradually expanded to include more and more functionallity, to the point where it's now become one of my most commonly used gadgets, and if there's anyone out there reading this who finds a use for it, be my guest.

## DHCPLookup.ps1

The main purpose of DHCPLookup.ps1 [(link)](https://github.com/Urichh/random-powershell/blob/main/DHCPLookup.ps1) is to enable the user to search DHCP reservations/leases simply using the CLI. It supports querying by:
 - IP address
 - subnet
 - MAC address
 - hostname/description

Simply supply one or more of the above mentioned parameters as arguments to the script, and it will perform the queries.

**Note**: the DHCP servers should be specified in the $DHCPServers list!

### optional features

If you don't want the script to query all DHCP servers (for example in cases where you already know which server holds your desired reservation/lease), you can supply the script with a `-s` flag, followed by the DHCP servers hostname/IP address, and it will only query that one.

Example: `./DHCPLookup.ps1 -s mydhcpserver 10.11.12.13`

## examples

![DHCPLookup by MAC address]({{ site.baseurl }}/assets/images/DHCPLookup_by_MAC.png)

![DHCPLookup by IP address]({{ site.baseurl }}/assets/images/DHCPLookup_by_ip.png)

![DHCPLookup by hostname]({{ site.baseurl }}/assets/images/DHCPLookup_by_hostname.png)