---
title: java 싱글톤 DCL(double-checked-locking) 기법에서 volatile의 역할 
date: 2024-03-20
update: 2024-03-20
tags:
- singleton
- DCL
- java
- volatile
---

디자인 패턴 중 싱글톤 패턴을 학습하다보면 구현 방법 중 DCL 기법을 접하게 된다. 현재는 싱글톤 패턴이 안티패턴이다라는 의견도 
나오고 있는 상황이라 그냥 기법의 형식 정도만 봐두고 지나 갈 수도 있었지만, volatile 키워드, 객체 초기화등 여러 개념이
섞여있어 그냥 지나 칠수 만은 없었다. 이글에서는 어리석게도 사소한 것에 집착하는 한 개발자 지망생의 생각을 다룬다.

## DCL(double-checked-locking) 기법이란?
> 싱글톤 패턴의 단 하나만의 인스턴를 생성한다라는 아이디어를 멀티 스레드 환경에서 효율적으로 구현하기 위한 기법.

```java
public class Singleton {
    private static Singleton instance;

    // 인스턴스를 반환하는 메서드
    public static Singleton getInstance() {
        // 첫 번째 체크: 이미 초기화된 경우 바로 반환
        if (instance == null) {
            synchronized (Singleton.class) {
                // 두 번째 체크: 동기화된 블록 내에서 다시 확인
                if (instance == null) {
                    instance = new Singleton();
                }
            }
        }
        return instance;
    }
}
```

`synchronized` 블록을 두어 멀티쓰레딩 환경에서 동시성 문제를 해결하고,
내부 객체의 존재 여부 검사 (`instance==null`)을 두번 확인한다 하여 `double-checked locking`이름을 가진다.

사실 이 코드는 완벽하지 않다. 현재 받아 들여지는 완벽한 형식은

    private static [volatile] Singleton instance;

위와 같이 `volatile` 키워드가 존재해야 완벽해진다. 얼핏보면 당연한 것처럼 생각 된다. 근데 왜 당연한가? 

## 명령어 재정렬
영미권에서는 `instruction reodering`이라고 부르는 이 현상(?)은 명령어의 순서를 재정렬하여 최적화한다.
그럼 위의 코드에서는 어떻게 일어날 수 있을까? 생각보다 엉뚱한 위치에서 일어나는데,
바로
    
    instance = new Singleton();

싱글톤 객체를 생성할때 발생 할 수 있다. 이부분은 참고자료가 많지 않았지만, 공통적으로 설명하고 있는 것은 다음과 같다.
객체를 생성할 때 재정렬에 의해 위와 같은 순서로 명령어가 실행 될 수 있다.
+ 객체를 할당할 메모리 공간확보
+ 변수에 해당 메모리 공간 링크
+ 객체 초기화

그럼 대체 무슨 문제가 발생하는가? 객체가 초기화 되기전에 변수에 해당 메모리가 할당된다. 동시성 문제에 대입하면,
다른 쓰레드에서 해당 객체에 접근하려할때, 초기화되지 않은 이른바 `불완전한` 상태의 객체에 접근하는 현상이 발생할 수 있다는 것이다.

불완전한 상태의 객체에 접근한다? 굉장히 구미가 당긴다. 그리고 직접 해보기 전까지 끝까지 의심하는 내 성격상 결코 지나칠 수 없었다.
그래서 테스트 코드를 작성했다.

```java
import java.util.HashSet;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentSkipListSet;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.Test;

public class Test3 {

	@Test
	public void testSingletonInstance() throws InterruptedException {
		int numberOfThreads = 500;
		ExecutorService executor = Executors.newFixedThreadPool(numberOfThreads);
		CountDownLatch latch = new CountDownLatch(numberOfThreads);
		Singleton singleton = new singleton();
		Set<Integer> set = ConcurrentHashMap.newKeySet();
		Runnable task = () -> {
			try {
				set.add(singleton.getTarget().value);
			} finally {
				latch.countDown();  // Decrement the latch count
			}
		};

		// Submit tasks to executor
		for (int i = 0; i < numberOfThreads; i++) {
			executor.submit(task);
		}

		latch.await(5, TimeUnit.SECONDS);  // Wait for all tasks to complete
		executor.shutdown();

		Assertions.assertTrue(set.size() == 1 && set.contains(100));
	}
}
```

싱글톤 객체의 생성자 초기화 블록에서 필드를 100으로 초기화하고 객체를 생성한다.
그럼 사실상 이코드는 항상 `Assertions.assertTrue(set.size() == 1 && set.contains(100));`가 성공해야하머,
만약 set의 사이즈가 1보다 크거나 혹은 100으로 초기화 되지않고 초기값인 0을 가지고 있다면 그토록 원하던 `불완전한` 객체를 얻은 경우라고
추론 할 수 있었다.

해당 코드를 작성하고 테스트가 실패할때 까지 반복했다. 1000번, 10000번,,,전혀 실패하지 않았다. 
생성자에 `Thread.sleep()`으로 충분히 시간을 주거나 필드를 상당히 많이 추가하거나 모든 상황을 다 실험 해봐도 내가 원하던 현상을 
재현 할 수 없었다.

`stack over flow`에서 나와 비슷한 실험을 한 전우들 꽤나 있었는데, 그 중 다음과 같은 코멘트가 있었다.

> But to answer your actual question: basically all implementations of the JVM implement the memory model in a looser fashion than its specification. Therefore, the non-volatile DCL might just work on many machines despite the improper synchronization because of an implementation detail. You should however never code against the implementation but always against the specification. Otherwise, your code might fail only sometimes and only on some machines what is a terrible bug to trace! This has nothing to do with the synchronized block being atomic, it solely relates to how your VM executes your code where the constructor might incidentally always be executed before publicizing your instance to the resource field.

기본적으로 JVM의 모든 구현체들은 메모리 모델을 명세보다 더 느슨하게 구현한다. 
따라서, 잘못된 동기화에도 불구하고 non-volatile DCL (Double-Checked Locking)이 
문제없이 동작할 수 있어. 그러나, 구현에 의존하지 말고 항상 명세에 맞춰 코드를 작성해야해. 
그렇지 않으면 코드가 때때로 특정 머신에서만 실패할 수 있으며, 이는 추적하기 매우 어려운 버그가 될 수 있어!

라고 해석할 수 있다. (실제로는 이런 뉘앙스로 작성하진 않았겠지만, 내가 느끼기엔 선배개발자가 따뜻하게 충고해주는 느낌이였다.)

## 결론
결론은 문제상황을 관측하는데는 실패했지만, 위와 같은 상황이 `이론적으로` 발생할 수 있으며 이는 `volatile`키워드로 해결할 수 있다.
단순히 메인 메모리의 직접 접근이라는 특성 이외에 `volaitle`키워드의 `happens-before` 보장이라는 특성덕분에
객체의 초기화 이전에 접근하는 현상을 막을 수 있다.

> 참고로 volatile 키워드는 java5버전 이후에 특성이 확장되었다. 따라서 dcl 패턴 또한 Java 5버전 이전까지는 volatile 키워드를
> 사용하는 것만으로 완전히 문제를 해결할 수 없어서 double-checked-locking is broken이라는 인식이 존재했다.

---

## 참고
<a href="https://stackoverflow.com/questions/34450511/does-the-latest-jmm-specify-the-synchronized-block-to-be-atomic-to-other-threads/34454970#34454970
" target="_blank">Does the latest JMM specify the synchronized block to be atomic to other threads even asynchronized ones? - stack overflow </a>

<a href="https://mong-dev.tistory.com/23" target="_blank">[Thread] Volatile이란, Volatile과 DCL(Double Checking Locking) 공부 기록</a>

<a href="https://en.wikipedia.org/wiki/Double-checked_locking" target="_blank">Double-checked locking - Wikipedia</a>


