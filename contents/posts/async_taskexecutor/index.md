---
title: @Async와 TaskExecutor
date: 2024-02-01
update: 2024-02-01
tags:
  - async
  - TaskExecutor
---



### @async 란?
스프링에서 비동기적인 작업을 처리하는 어노테이션으로 `AOP`로 동작하기 때문에 비동기처리의 관심사를 분리하고, 개발자로 하여금 비즈니스 로직에 집중할 수 있게 해준다.

```java
@Service 
public class MyService { 
		@Async
		public void asyncMethod() { 
			// 비동기적으로 실행될 작업 
		}
}
```


### @asnyc의 동작방식
`@Asnyc`어노테이션이 붙은 메서드가 호출되면 스프링은 내부적으로 `TaskExecutor`인터페이스를 구현한 구현체로부터 작업을 수행하게 된다. 이때, 별도의 `TaskExectuir`를 지정하지않으면 , default로 `SimpleAsyncTaskExecutor`가 기본적으로 사용된다.

#### 💬 `SimpleAsyncTaskExecutor` 의 단점

>TaskExecutor implementation that fires up a new Thread for each task, executing it asynchronously.
Supports limiting concurrent threads through setConcurrencyLimit. By default, the number of   concurrent task executions is unlimited.
NOTE: This implementation does not reuse threads! Consider a thread-pooling TaskExecutor implementation instead, in particular for executing a large number of short-lived tasks.

위는 SimpleAsyncTaskExectutor의 java doc 코멘트인데 요약하면
+ 각각의 작업에 대하여 스레드를 생성하여 비동기로 처리한다.
+ 기본적으로 동시 작업 실행수에 제한을 두고 있지 않는다.
+ 스레드를 재사용하지 않는다. 스레드 풀링 `TaskExecutor` 구현을 고려하라. (특히 많은 수의 짧은 작업들의 경우)



### ThreadPoolTaskExecutor 활용
위의 권장 사항 대로 스레드 풀 기반의 `TaskExecutor`를 사용해보자.





